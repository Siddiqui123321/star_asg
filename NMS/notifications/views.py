from django.conf import settings
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status

from .models import NotificationTemplate, OneSignalSubscriber, Trigger
from .serializers import NotificationTemplateSerializer, OneSignalSubscriberSerializer, TriggerSerializer
from .services import (
    build_notification_context,
    render_text,
    send_postmark_email,
    send_web_push,
    send_whatsapp_message,
)


def check_admin_auth(request):
    token = request.headers.get('Authorization', '')
    expected = f'Bearer {settings.ADMIN_API_TOKEN}'
    return token == expected


def require_admin(view_func):
    def wrapped(request, *args, **kwargs):
        if not check_admin_auth(request):
            return Response({'detail': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
        return view_func(request, *args, **kwargs)

    wrapped.__name__ = view_func.__name__
    return wrapped


@api_view(['POST'])
@permission_classes([AllowAny])
def admin_login(request):
    username = request.data.get('username')
    password = request.data.get('password')
    if username == settings.ADMIN_USERNAME and password == settings.ADMIN_PASSWORD:
        return Response({'token': settings.ADMIN_API_TOKEN})
    return Response({'detail': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)


@api_view(['GET'])
@permission_classes([AllowAny])
@require_admin
def trigger_list(request):
    triggers = Trigger.objects.prefetch_related('templates').all()
    serializer = TriggerSerializer(triggers, many=True)
    return Response(serializer.data)


@api_view(['PATCH'])
@permission_classes([AllowAny])
@require_admin
def update_template(request, template_id):
    try:
        template = NotificationTemplate.objects.get(pk=template_id)
    except NotificationTemplate.DoesNotExist:
        return Response({'detail': 'Template not found'}, status=status.HTTP_404_NOT_FOUND)
    serializer = NotificationTemplateSerializer(template, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([AllowAny])
@require_admin
def create_trigger(request):
    slug = request.data.get('slug')
    name = request.data.get('name')
    description = request.data.get('description', '')
    if not slug or not name:
        return Response({'detail': 'Trigger slug and name are required'}, status=status.HTTP_400_BAD_REQUEST)
    if Trigger.objects.filter(slug=slug).exists():
        return Response({'detail': 'Trigger slug already exists'}, status=status.HTTP_400_BAD_REQUEST)
    trigger = Trigger.objects.create(slug=slug, name=name, description=description)

    defaults = [
        {
            'channel': NotificationTemplate.CHANNEL_WHATSAPP,
            'enabled': False,
            'subject': '',
            'title': '',
            'body': f'Hello {{user_name}}, this is a WhatsApp notification for {name}.',
        },
        {
            'channel': NotificationTemplate.CHANNEL_EMAIL,
            'enabled': False,
            'subject': f'{name} Notification',
            'title': '',
            'body': f'Hello {{user_name}}, this is an email notification for {name}.',
        },
        {
            'channel': NotificationTemplate.CHANNEL_WEB_PUSH,
            'enabled': False,
            'subject': '',
            'title': f'{name} Alert',
            'body': f'Hello {{user_name}}, this is a browser push notification for {name}.',
        },
    ]
    for values in defaults:
        NotificationTemplate.objects.create(trigger=trigger, **values)

    serializer = TriggerSerializer(trigger)
    return Response(serializer.data, status=status.HTTP_201_CREATED)


def build_send_context(request):
    user_data = request.data.get('user', {})
    return build_notification_context(request.data.get('trigger_slug', 'unknown'), user_data)


def send_template(template: NotificationTemplate, context: dict, test_mode: bool = False, external_user_ids: list[str] | None = None) -> dict:
    data = {
        'channel': template.channel,
        'success': False,
        'message': '',
    }
    if not template.enabled:
        data['message'] = 'disabled'
        return data
    if template.channel == NotificationTemplate.CHANNEL_WHATSAPP:
        body = render_text(template.body, context)
        to_phone = settings.TEST_WHATSAPP_RECIPIENT if test_mode else settings.TEST_WHATSAPP_RECIPIENT
        if not body:
            data['message'] = 'empty whatsapp body'
            return data
        try:
            response = send_whatsapp_message(to_phone=to_phone, body=body)
            data['success'] = True
            data['message'] = response
        except Exception as exc:
            data['message'] = str(exc)
    elif template.channel == NotificationTemplate.CHANNEL_EMAIL:
        subject = render_text(template.subject, context)
        body = render_text(template.body, context)
        if not subject or not body:
            data['message'] = 'empty email subject/body'
            return data
        email_to = settings.TEST_EMAIL_RECIPIENT if test_mode else settings.TEST_EMAIL_RECIPIENT
        try:
            response = send_postmark_email(to_email=email_to, subject=subject, html_body=body)
            data['success'] = True
            data['message'] = response
        except Exception as exc:
            data['message'] = str(exc)
    elif template.channel == NotificationTemplate.CHANNEL_WEB_PUSH:
        title = render_text(template.title, context)
        body = render_text(template.body, context)
        if not title or not body:
            data['message'] = 'empty push title/body'
            return data
        if external_user_ids:
            subscribers = external_user_ids
        else:
            subscribers = list(OneSignalSubscriber.objects.values_list('external_user_id', flat=True))
        if not subscribers:
            data['message'] = 'no web push subscribers'
            return data
        try:
            response = send_web_push(subscribers, title, body)
            data['success'] = True
            data['message'] = response
        except Exception as exc:
            data['message'] = str(exc)
    else:
        data['message'] = 'unsupported channel'
    return data


@api_view(['POST'])
@permission_classes([AllowAny])
@require_admin
def test_send(request, template_id):
    try:
        template = NotificationTemplate.objects.get(pk=template_id)
    except NotificationTemplate.DoesNotExist:
        return Response({'detail': 'Template not found'}, status=status.HTTP_404_NOT_FOUND)
    context = build_notification_context(request.data.get('trigger_slug', template.trigger.slug), request.data.get('user'))
    result = send_template(
        template,
        context,
        test_mode=True,
        external_user_ids=request.data.get('external_user_ids'),
    )
    return Response(result)


@api_view(['POST'])
@permission_classes([AllowAny])
def fire_trigger(request):
    trigger_slug = request.data.get('trigger_slug')
    user_data = request.data.get('user', {})
    if not trigger_slug:
        return Response({'detail': 'trigger_slug is required'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        trigger = Trigger.objects.get(slug=trigger_slug)
    except Trigger.DoesNotExist:
        return Response({'detail': 'Trigger not found'}, status=status.HTTP_404_NOT_FOUND)
    context = build_notification_context(trigger_slug, user_data)
    results = []
    external_user_ids = request.data.get('external_user_ids')
    for template in trigger.templates.filter(enabled=True):
        results.append(send_template(template, context, test_mode=False, external_user_ids=external_user_ids))
    return Response({'trigger': trigger.slug, 'results': results})


@api_view(['POST'])
@permission_classes([AllowAny])
def subscribe_push(request):
    serializer = OneSignalSubscriberSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    obj, _ = OneSignalSubscriber.objects.update_or_create(
        external_user_id=serializer.validated_data['external_user_id'],
        defaults={'name': serializer.validated_data.get('name', '')},
    )
    return Response(OneSignalSubscriberSerializer(obj).data)
