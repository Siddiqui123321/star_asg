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
    response.raise_for_status()
    return response.json()


def send_web_push(external_ids: list[str], title: str, body: str, url: str = None) -> dict:
    if not settings.ONESIGNAL_APP_ID or not settings.ONESIGNAL_REST_API_KEY:
        raise ValueError('OneSignal credentials are not configured')
    endpoint = 'https://onesignal.com/api/v1/notifications'
    payload = {
        'app_id': settings.ONESIGNAL_APP_ID,
        'include_external_user_ids': external_ids,
        'headings': {'en': title},
        'contents': {'en': body},
    }
    if url:
        payload['url'] = url
    headers = {
        'Authorization': f'Basic {settings.ONESIGNAL_REST_API_KEY}',
        'Content-Type': 'application/json; charset=utf-8',
    }
    response = requests.post(endpoint, json=payload, headers=headers, timeout=15)
    response.raise_for_status()
    return response.json()


def build_notification_context(trigger_slug: str, user: dict | None = None) -> dict:
    data = {
        'trigger': trigger_slug,
        'user_name': user.get('name') if user else 'Guest',
        'user_email': user.get('email', '' ) if user else '',
    }
    data.update(user or {})
    return data
