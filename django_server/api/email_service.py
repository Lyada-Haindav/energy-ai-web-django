import json
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from django.conf import settings


BREVO_API_URL = "https://api.brevo.com/v3/smtp/email"


def get_app_base_url(request=None):
    if request is not None:
        return request.build_absolute_uri("/").rstrip("/")

    configured = str(getattr(settings, "APP_BASE_URL", "") or "").rstrip("/")
    if configured:
        return configured
    return f"http://127.0.0.1:{settings.APP_PORT}"


def sender_config():
    email = getattr(settings, "EMAIL_FROM", None) or getattr(settings, "DEFAULT_FROM_EMAIL", "") or ""
    name = getattr(settings, "EMAIL_FROM_NAME", "Energy AI")
    return {"email": email, "name": name} if email else None


def send_brevo_email(*, to, subject, html_content, text_content):
    sender = sender_config()
    api_key = getattr(settings, "BREVO_API_KEY", "")

    if not api_key or not sender:
        reasons = []
        if not api_key:
            reasons.append("Email delivery is disabled because the Brevo API key is not configured.")
        if not sender:
            reasons.append("Email delivery is disabled because the sender address is not configured.")
        return {
            "delivered": False,
            "previewOnly": True,
            "error": " ".join(reasons) or "Email delivery is not configured.",
        }

    payload = {
        "sender": sender,
        "to": [{"email": to.get("email"), "name": to.get("name") or to.get("email")}],
        "subject": subject,
        "htmlContent": html_content,
        "textContent": text_content,
    }
    request = Request(
        BREVO_API_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "accept": "application/json",
            "content-type": "application/json",
            "api-key": api_key,
        },
        method="POST",
    )

    try:
        with urlopen(request, timeout=15) as response:
            if 200 <= response.status < 300:
                return {"delivered": True, "previewOnly": False}
            body = response.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"Brevo send failed: {body or response.status}")
    except HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Brevo send failed: {body or error.reason}") from error
    except URLError as error:
        raise RuntimeError(f"Brevo send failed: {error.reason}") from error


def build_verify_url(token, email="", request=None):
    params = {"token": str(token or "")}
    if email:
        params["email"] = str(email)
    return f"{get_app_base_url(request)}/#/verify-email?{urlencode(params)}"


def build_reset_url(token, request=None):
    return f"{get_app_base_url(request)}/#/reset-password?token={urlencode({'token': str(token or '')})[6:]}"


def send_verification_email(*, user, token, request=None):
    verify_url = build_verify_url(token, user.get("email", ""), request=request)
    try:
        result = send_brevo_email(
            to=user,
            subject="Verify your Energy AI email",
            text_content=f"Verify your email for Energy AI: {verify_url}",
            html_content=(
                '<div style="font-family:Arial,sans-serif;color:#14261a;line-height:1.6">'
                '<h2 style="margin:0 0 12px">Verify your Energy AI email</h2>'
                f'<p>Hi {user.get("name") or "there"},</p>'
                "<p>Confirm your email to finish setting up your account.</p>"
                f'<p><a href="{verify_url}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#0f2f20;color:#ffffff;text-decoration:none">Verify email</a></p>'
                "<p>If the button does not work, open this link:</p>"
                f"<p>{verify_url}</p>"
                "</div>"
            ),
        )
    except Exception as error:
        result = {
            "delivered": False,
            "previewOnly": True,
            "error": str(error) or "Brevo delivery failed.",
        }

    return {**result, "previewUrl": verify_url} if result.get("previewOnly") else result


def send_password_reset_email(*, user, token, request=None):
    reset_url = build_reset_url(token, request=request)
    try:
        result = send_brevo_email(
            to=user,
            subject="Reset your Energy AI password",
            text_content=f"Reset your Energy AI password: {reset_url}",
            html_content=(
                '<div style="font-family:Arial,sans-serif;color:#14261a;line-height:1.6">'
                '<h2 style="margin:0 0 12px">Reset your Energy AI password</h2>'
                f'<p>Hi {user.get("name") or "there"},</p>'
                "<p>Use this link to choose a new password. It expires in 30 minutes.</p>"
                f'<p><a href="{reset_url}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#0f2f20;color:#ffffff;text-decoration:none">Reset password</a></p>'
                "<p>If the button does not work, open this link:</p>"
                f"<p>{reset_url}</p>"
                "</div>"
            ),
        )
    except Exception as error:
        result = {
            "delivered": False,
            "previewOnly": True,
            "error": str(error) or "Brevo delivery failed.",
        }

    return {**result, "previewUrl": reset_url} if result.get("previewOnly") else result
