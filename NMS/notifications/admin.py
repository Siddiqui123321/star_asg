from django.contrib import admin

from .models import NotificationTemplate, OneSignalSubscriber, Trigger


@admin.register(Trigger)
class TriggerAdmin(admin.ModelAdmin):
    list_display = ['name', 'slug']


@admin.register(NotificationTemplate)
class NotificationTemplateAdmin(admin.ModelAdmin):
    list_display = ['trigger', 'channel', 'enabled', 'updated_at']
    list_filter = ['channel', 'enabled']


@admin.register(OneSignalSubscriber)
class OneSignalSubscriberAdmin(admin.ModelAdmin):
    list_display = ['external_user_id', 'name', 'created_at']
