from django.urls import path

from . import views


urlpatterns = [
    path("health", views.health_view),
    path("auth/register", views.register_view),
    path("auth/login", views.login_view),
    path("auth/me", views.me_view),
    path("auth/logout", views.logout_view),
    path("auth/verify-email", views.verify_email_view),
    path("auth/resend-verification", views.resend_verification_view),
    path("auth/forgot-password", views.forgot_password_view),
    path("auth/reset-password", views.reset_password_view),
    path("chats", views.chats_view),
    path("chats/feedback", views.chat_feedback_view),
    path("chat", views.chat_view),
    path("analytics/overview", views.analytics_overview_view),
    path("admin/overview", views.admin_overview_view),
    path("admin/retrain", views.admin_retrain_view),
    path("admin/evaluations/run", views.admin_run_evaluations_view),
]
