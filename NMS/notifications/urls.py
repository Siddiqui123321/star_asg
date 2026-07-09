from django.urls import path

from . import views

urlpatterns = [
    path('admin/login/', views.admin_login, name='admin-login'),
    path('admin/triggers/', views.trigger_list, name='trigger-list'),
    path('admin/triggers/create/', views.create_trigger, name='create-trigger'),
    path('admin/templates/<int:template_id>/', views.update_template, name='update-template'),
    path('admin/templates/<int:template_id>/test/', views.test_send, name='test-send'),
    path('trigger-fire/', views.fire_trigger, name='fire-trigger'),
    path('subscribe/', views.subscribe_push, name='subscribe-push'),
]
