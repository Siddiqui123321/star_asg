import os
import requests
from django.conf import settings


def render_text(template: str, context: dict) -> str:
    if not template:
        return ''
    try:
        return template.format(**context)
    except Exception:
        return template


def send_whatsapp_message(to_phone: str, body: str) -> dict:
    if not settings.WHATSAPP_ACCESS_TOKEN or not settings.PHONE_NUMBER_ID:
        raise ValueError('WhatsApp credentials are not configured')
    url = f'https://graph.facebook.com/v17.0/{settings.PHONE_NUMBER_ID}/messages'
    payload = {
        'messaging_product': 'whatsapp',
        'to': to_phone,
        'type': 'text',
        'text': {'body': body},
    }
    headers = {
        'Authorization': f'Bearer {settings.WHATSAPP_ACCESS_TOKEN}',
        'Content-Type': 'application/json',
    }
    response = requests.post(url, json=payload, headers=headers, timeout=15)
    response.raise_for_status()
    return response.json()


def send_postmark_email(to_email: str, subject: str, html_body: str, text_body: str = None) -> dict:
    if not settings.POSTMARKAPP_TOKEN or not settings.POSTMARK_FROM_EMAIL:
        raise ValueError('Postmark credentials are not configured')
    if not text_body:
        text_body = html_body
    url = 'https://api.postmarkapp.com/email'
    payload = {
        'From': settings.POSTMARK_FROM_EMAIL,
        'To': to_email,
        'Subject': subject,
        'TextBody': text_body,
        'HtmlBody': html_body,
    }
    headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Postmark-Server-Token': settings.POSTMARKAPP_TOKEN,
    }
    response = requests.post(url, json=payload, headers=headers, timeout=15)
    if not response.ok:
        detail = response.text
        try:
            detail = response.json()
        except Exception:
            pass
        raise ValueError(f'Postmark error ({response.status_code}): {detail}')
    return response.json()


def send_web_push(player_ids: list[str], title: str, body: str, url: str = None) -> dict:
    if not settings.ONESIGNAL_APP_ID:
        raise ValueError('OneSignal credentials are not configured')
    if not player_ids:
        raise ValueError('No OneSignal player IDs provided')

    base_payload = {
        'app_id': settings.ONESIGNAL_APP_ID,
        'headings': {'en': title},
        'contents': {'en': body},
    }
    if url:
        base_payload['url'] = url

    attempts = [
        {
            'endpoint': 'https://api.onesignal.com/notifications',
            'payload': {
                **base_payload,
                'target_channel': 'push',
                'include_subscription_ids': player_ids,
            },
            'headers': {
                'Authorization': f'Key {settings.ONESIGNAL_REST_API_KEY}',
                'Content-Type': 'application/json; charset=utf-8',
            },
        },
        {
            'endpoint': 'https://onesignal.com/api/v1/notifications',
            'payload': {
                **base_payload,
                'include_player_ids': player_ids,
            },
            'headers': {
                'Authorization': f'Basic {settings.ONESIGNAL_REST_API_KEY}',
                'Content-Type': 'application/json; charset=utf-8',
            },
        },
        {
            'endpoint': 'https://onesignal.com/api/v1/notifications',
            'payload': {
                **base_payload,
                'include_player_ids': player_ids,
            },
            'headers': {
                'Content-Type': 'application/json; charset=utf-8',
            },
        },
    ]

    last_error = None
    for attempt in attempts:
        if 'Authorization' in attempt['headers'] and not settings.ONESIGNAL_REST_API_KEY:
            continue
        response = requests.post(
            attempt['endpoint'],
            json=attempt['payload'],
            headers=attempt['headers'],
            timeout=15,
        )
        if response.ok:
            return response.json()
        detail = response.text
        try:
            detail = response.json()
        except Exception:
            pass
        last_error = f'OneSignal error ({response.status_code}): {detail}'

    raise ValueError(last_error or 'OneSignal request failed')


def build_notification_context(trigger_slug: str, user: dict | None = None) -> dict:
    data = {
        'trigger': trigger_slug,
        'user_name': user.get('name') if user else 'Guest',
        'user_email': user.get('email', '' ) if user else '',
    }
    data.update(user or {})
    return data
