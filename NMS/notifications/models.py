from django.db import models


class Trigger(models.Model):
    slug = models.SlugField(max_length=100, unique=True)
    name = models.CharField(max_length=120)
    description = models.TextField(blank=True)

    def __str__(self) -> str:
        return self.name


class NotificationTemplate(models.Model):
    CHANNEL_WHATSAPP = 'whatsapp'
    CHANNEL_EMAIL = 'email'
    CHANNEL_WEB_PUSH = 'web_push'

    CHANNEL_CHOICES = [
        (CHANNEL_WHATSAPP, 'WhatsApp'),
        (CHANNEL_EMAIL, 'Email'),
        (CHANNEL_WEB_PUSH, 'Web Push'),
    ]

    trigger = models.ForeignKey(Trigger, related_name='templates', on_delete=models.CASCADE)
    channel = models.CharField(max_length=16, choices=CHANNEL_CHOICES)
    enabled = models.BooleanField(default=False)
    subject = models.CharField(max_length=250, blank=True)
    title = models.CharField(max_length=250, blank=True)
    body = models.TextField(blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('trigger', 'channel')
        ordering = ['trigger', 'channel']

    def __str__(self) -> str:
        return f'{self.trigger.name} - {self.channel}'


class OneSignalSubscriber(models.Model):
    external_user_id = models.CharField(max_length=255, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    name = models.CharField(max_length=120, blank=True)

    def __str__(self) -> str:
        return self.external_user_id
