"""
Email delivery service.

Provider order (first one configured wins):
  1. Brevo HTTP API — set BREVO_API_KEY (preferred — no SMTP needed)
  2. SMTP           — set SMTP_HOST
  3. SendGrid       — set SENDGRID_API_KEY
  4. Dev log        — no provider configured; magic links are printed to logs.
"""
import asyncio
import logging
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

BREVO_API_URL = "https://api.brevo.com/v3/smtp/email"


async def send_magic_link(
    to_email: str,
    full_name: str,
    token: str,
    attempt_title: str,
    event_title: str | None = None,
) -> bool:
    """Send witness invitation email with magic link."""
    magic_url = f"{settings.FRONTEND_URL}/witness/sign/{token}"
    display_title = event_title or attempt_title
    subject = f"You've been invited to witness for {display_title}"
    html = _magic_link_html(full_name, display_title, magic_url, to_email)
    text = (
        f"Dear {full_name},\n\n"
        f"You have been invited to witness the Guinness World Records attempt:\n"
        f"  {display_title}\n\n"
        f"Your username is your email address: {to_email}\n"
        f"No password is required — the link below signs you in automatically.\n\n"
        f"Open your witness portal:\n  {magic_url}\n\n"
        f"This link expires in {settings.MAGIC_LINK_EXPIRE_HOURS} hours.\n"
    )
    return await _deliver(to_email, full_name, subject, html, text, dev_hint=f"Magic link: {magic_url}")


async def send_notification_email(to_email: str, subject: str, body: str) -> bool:
    html = f"<p>{body}</p>"
    return await _deliver(to_email, None, subject, html, body, dev_hint=f"Email → {to_email}: {subject}")


# ---------------------------------------------------------------------------
# Dispatcher
# ---------------------------------------------------------------------------
async def _deliver(to_email: str, to_name: str | None, subject: str, html: str, text: str, *, dev_hint: str) -> bool:
    if settings.BREVO_API_KEY:
        return await _send_brevo(to_email, to_name, subject, html, text)
    if settings.SMTP_HOST:
        return await asyncio.to_thread(_send_smtp, to_email, subject, html, text)
    if settings.SENDGRID_API_KEY:
        return await _send_sendgrid(to_email, subject, html)
    logger.info("[email:dev] %s", dev_hint)
    return True


# ---------------------------------------------------------------------------
# Brevo HTTP API
# ---------------------------------------------------------------------------
async def _send_brevo(to_email: str, to_name: str | None, subject: str, html: str, text: str) -> bool:
    sender_email = settings.EMAIL_FROM or "noreply@glimmora.com"
    sender_name = settings.SMTP_FROM_NAME or "GWR Records"
    payload = {
        "sender": {"name": sender_name, "email": sender_email},
        "to": [{"email": to_email, **({"name": to_name} if to_name else {})}],
        "subject": subject,
        "htmlContent": html,
        "textContent": text,
    }
    headers = {
        "accept": "application/json",
        "api-key": settings.BREVO_API_KEY,
        "content-type": "application/json",
    }
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(BREVO_API_URL, json=payload, headers=headers)
        if resp.status_code in (200, 201, 202):
            logger.info("Brevo sent → %s (%s)", to_email, subject)
            return True
        logger.error("Brevo send failed → %s: %s %s", to_email, resp.status_code, resp.text)
        return False
    except Exception as e:
        logger.error("Brevo send error → %s: %s", to_email, e)
        return False


# ---------------------------------------------------------------------------
# SMTP transport (stdlib only — no extra dependency)
# ---------------------------------------------------------------------------
def _send_smtp(to_email: str, subject: str, html: str, text: str) -> bool:
    from_addr = settings.EMAIL_FROM or settings.SMTP_USERNAME
    if not from_addr:
        logger.error("SMTP: no sender configured (set EMAIL_FROM or SMTP_USERNAME)")
        return False

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = formataddr((settings.SMTP_FROM_NAME or "", from_addr))
    msg["To"] = to_email
    msg.set_content(text)
    msg.add_alternative(html, subtype="html")

    try:
        if settings.SMTP_USE_SSL:
            ctx = ssl.create_default_context()
            with smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, context=ctx, timeout=20) as s:
                if settings.SMTP_USERNAME:
                    s.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
                s.send_message(msg)
        else:
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=20) as s:
                s.ehlo()
                if settings.SMTP_USE_TLS:
                    s.starttls(context=ssl.create_default_context())
                    s.ehlo()
                if settings.SMTP_USERNAME:
                    s.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
                s.send_message(msg)
        logger.info("SMTP sent → %s (%s)", to_email, subject)
        return True
    except Exception as e:
        logger.error("SMTP send failed → %s: %s", to_email, e)
        return False


# ---------------------------------------------------------------------------
# SendGrid transport (kept for backwards compat)
# ---------------------------------------------------------------------------
async def _send_sendgrid(to_email: str, subject: str, html: str) -> bool:
    try:
        import sendgrid
        from sendgrid.helpers.mail import Mail

        sg = sendgrid.SendGridAPIClient(api_key=settings.SENDGRID_API_KEY)
        message = Mail(
            from_email=settings.EMAIL_FROM,
            to_emails=to_email,
            subject=subject,
            html_content=html,
        )
        response = sg.send(message)
        return response.status_code in (200, 202)
    except Exception as e:
        logger.error("SendGrid send failed: %s", e)
        return False


# ---------------------------------------------------------------------------
# Templates
# ---------------------------------------------------------------------------
def _magic_link_html(full_name: str, event_title: str, url: str, to_email: str) -> str:
    return f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color:#1a1a2e;">GWR Witness Invitation</h2>
      <p>Dear {full_name},</p>
      <p>You have been invited to witness the Guinness World Records attempt:</p>
      <p><strong>{event_title}</strong></p>
      <div style="background:#f4f6fb;border:1px solid #e3e7f3;border-radius:6px;padding:12px 16px;margin:16px 0;font-size:13px;color:#1a1a2e;">
        <strong>Sign-in details</strong><br>
        Username: <span style="font-family:monospace;">{to_email}</span><br>
        Password: <em>not required</em> — the secure link below signs you in automatically.
      </div>
      <p>Please click the button below to access your witness portal and complete your statement:</p>
      <p>
        <a href="{url}" style="background:#1d4ed8;color:#ffffff;padding:12px 28px;text-decoration:none;border-radius:6px;display:inline-block;margin:16px 0;font-weight:600;">
          Open Witness Portal
        </a>
      </p>
      <p style="font-size:12px;color:#666;">Or copy this link into your browser:<br><span style="word-break:break-all;">{url}</span></p>
      <p style="font-size:12px;color:#666;">This link expires in {settings.MAGIC_LINK_EXPIRE_HOURS} hours.</p>
      <p style="font-size:12px;color:#666;">If you did not expect this email, please ignore it.</p>
    </div>
    """
