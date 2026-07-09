from django.core.management.base import BaseCommand

from notifications.models import NotificationTemplate, Trigger


class Command(BaseCommand):
    help = 'Create default triggers and notification templates for local development.'

    def handle(self, *args, **options):
        triggers = [
            {'slug': 'login', 'name': 'Login', 'description': 'User signs in on the website.'},
            {'slug': 'logout', 'name': 'Logout', 'description': 'User signs out of the website.'},
        ]
        for trigger_data in triggers:
            trigger, created = Trigger.objects.get_or_create(slug=trigger_data['slug'], defaults=trigger_data)
            if created:
                self.stdout.write(self.style.SUCCESS(f"Created trigger: {trigger.slug}"))
            for channel in [NotificationTemplate.CHANNEL_WHATSAPP, NotificationTemplate.CHANNEL_EMAIL, NotificationTemplate.CHANNEL_WEB_PUSH]:
                NotificationTemplate.objects.get_or_create(
                    trigger=trigger,
                    channel=channel,
                    defaults={
                        'enabled': True,
                        'subject': 'Welcome back!' if channel == NotificationTemplate.CHANNEL_EMAIL else '',
                        'title': 'Welcome back!' if channel == NotificationTemplate.CHANNEL_WEB_PUSH else '',
                        'body': 'Welcome back!' if channel == NotificationTemplate.CHANNEL_WHATSAPP else 'You logged in successfully.' if channel == NotificationTemplate.CHANNEL_EMAIL else 'Welcome back to the site!',
                    },
                )
        self.stdout.write(self.style.SUCCESS('Default notification triggers seeded.'))
