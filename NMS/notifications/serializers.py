from rest_framework import serializers

from .models import NotificationTemplate, OneSignalSubscriber, Trigger


class NotificationTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotificationTemplate
        fields = [
            'id',
            'channel',
            'enabled',
            'subject',
            'title',
            'body',
            'updated_at',
        ]


class TriggerSerializer(serializers.ModelSerializer):
    templates = NotificationTemplateSerializer(many=True)

    class Meta:
        model = Trigger
        fields = ['id', 'slug', 'name', 'description', 'templates']


class OneSignalSubscriberSerializer(serializers.ModelSerializer):
    class Meta:
        model = OneSignalSubscriber
        fields = ['id', 'external_user_id', 'name', 'created_at']
