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
    magic_url = f"{settings.FRONTEND_URL}/login?invite={token}"
    display_title = event_title or attempt_title
    subject = f"You've been invited to witness for {display_title}"
    html = _magic_link_html(full_name, display_title, magic_url, to_email)
    text = (
        f"Dear {full_name},\n\n"
        f"You have been invited to witness the Guinness World Records attempt:\n"
        f"  {display_title}\n\n"
        f"Sign in to your witness portal using your email ({to_email}).\n"
        f"For the demo environment, use the witness sample account: witness@gwr.com / Witness@123.\n\n"
        f"Open the sign-in page:\n  {magic_url}\n\n"
        f"After signing in you'll be taken directly to your invitation.\n"
        f"This link expires in {settings.MAGIC_LINK_EXPIRE_HOURS} hours.\n"
    )
    return await _deliver(to_email, full_name, subject, html, text, dev_hint=f"Magic link: {magic_url}")


async def send_witness_decision_email(
    to_email: str,
    full_name: str,
    decision: str,
    attempt_title: str,
    note: str | None = None,
    invite_token: str | None = None,
) -> bool:
    """Email a witness when an adjudicator approves / rejects / requests clarification."""
    pretty = {
        "approved": "approved",
        "rejected": "rejected",
        "clarification_requested": "flagged for clarification",
    }.get(decision, decision)
    tone_colour = {
        "approved": "#15803d",
        "rejected": "#b91c1c",
        "clarification_requested": "#b45309",
    }.get(decision, "#1d4ed8")
    subject = f"Your GWR witness statement has been {pretty}"
    # If we have the invite token, route back through the magic-link login so
    # witnesses (who have no password) can still get in. Otherwise fall back.
    portal_url = (
        f"{settings.FRONTEND_URL}/login?invite={invite_token}"
        if invite_token else f"{settings.FRONTEND_URL}/login"
    )
    note_html = (
        f"<p style='background:#f8fafc;border-left:4px solid {tone_colour};padding:10px 14px;margin:14px 0;font-style:italic;'>"
        f"Adjudicator note: {note}</p>"
        if note else ""
    )
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color:#1a1a2e;">GWR Witness Statement Update</h2>
      <p>Dear {full_name},</p>
      <p>An official Guinness World Records adjudicator has reviewed your witness statement for:</p>
      <p><strong>{attempt_title}</strong></p>
      <p style="font-size:15px;">Decision: <strong style="color:{tone_colour};text-transform:capitalize;">{pretty}</strong></p>
      {note_html}
      <p>You can sign in to your witness portal to view the full decision and any next steps:</p>
      <p>
        <a href="{portal_url}" style="background:#1d4ed8;color:#ffffff;padding:10px 22px;text-decoration:none;border-radius:6px;display:inline-block;margin:10px 0;font-weight:600;">
          Open Witness Portal
        </a>
      </p>
      <p style="font-size:12px;color:#666;">Thank you for serving as an independent witness.</p>
    </div>
    """
    text = (
        f"Dear {full_name},\n\n"
        f"An adjudicator has {pretty} your witness statement for: {attempt_title}.\n"
        + (f"Adjudicator note: {note}\n\n" if note else "\n")
        + f"Open your witness portal: {portal_url}\n"
    )
    return await _deliver(to_email, full_name, subject, html, text, dev_hint=f"Decision ({pretty}) → {to_email}")


async def send_attempt_status_email(
    to_email: str,
    full_name: str,
    attempt_title: str,
    status: str,
    summary: str,
) -> bool:
    """Email the organizer when an attempt rolls up to approved or rejected."""
    pretty = {"approved": "approved", "rejected": "rejected"}.get(status, status)
    colour = "#15803d" if status == "approved" else "#b91c1c"
    subject = f"Your GWR attempt has been {pretty}"
    portal_url = f"{settings.FRONTEND_URL}/organizer/submissions"
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color:#1a1a2e;">Attempt review complete</h2>
      <p>Dear {full_name},</p>
      <p>All witnesses for your Guinness World Records attempt have been reviewed:</p>
      <p><strong>{attempt_title}</strong></p>
      <p style="font-size:15px;">Final outcome: <strong style="color:{colour};text-transform:capitalize;">{pretty}</strong></p>
      <p>{summary}</p>
      <p>
        <a href="{portal_url}" style="background:#1d4ed8;color:#ffffff;padding:10px 22px;text-decoration:none;border-radius:6px;display:inline-block;margin:10px 0;font-weight:600;">
          Open submission
        </a>
      </p>
    </div>
    """
    text = (
        f"Dear {full_name},\n\nYour attempt \"{attempt_title}\" is now {pretty}.\n"
        f"{summary}\n\nOpen submission: {portal_url}\n"
    )
    return await _deliver(to_email, full_name, subject, html, text, dev_hint=f"Attempt {pretty} → {to_email}")


async def send_certificate_ready_email(
    to_email: str,
    full_name: str,
    attempt_title: str,
    application_ref: str,
) -> bool:
    """Email the organizer when an adjudicator ratifies the attempt."""
    subject = f"Certificate ready: {attempt_title}"
    portal_url = f"{settings.FRONTEND_URL}/organizer/submissions"
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color:#1a1a2e;">Your record has been ratified</h2>
      <p>Dear {full_name},</p>
      <p>Congratulations — your Guinness World Records attempt has been officially ratified:</p>
      <p><strong>{attempt_title}</strong><br><span style="color:#475569;font-size:13px;">Application ref {application_ref}</span></p>
      <p>Your certificate is now ready in the organizer portal.</p>
      <p>
        <a href="{portal_url}" style="background:#b8860b;color:#ffffff;padding:10px 22px;text-decoration:none;border-radius:6px;display:inline-block;margin:10px 0;font-weight:600;">
          Download certificate
        </a>
      </p>
    </div>
    """
    text = (
        f"Dear {full_name},\n\nCongratulations — \"{attempt_title}\" (ref {application_ref}) "
        f"has been ratified. Download your certificate: {portal_url}\n"
    )
    return await _deliver(to_email, full_name, subject, html, text, dev_hint=f"Certificate ready → {to_email}")


async def send_attempt_submitted_to_organizer(
    to_email: str,
    full_name: str,
    attempt_title: str,
    application_ref: str,
    witness_count: int,
    evidence_count: int,
) -> bool:
    """Confirm to the organizer that their package was received by GWR."""
    subject = f"Submission received: {attempt_title}"
    portal_url = f"{settings.FRONTEND_URL}/organizer/submissions"
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color:#1a1a2e;">Submission received</h2>
      <p>Dear {full_name},</p>
      <p>Thank you — your Guinness World Records submission has been received and is now in the adjudication queue:</p>
      <p><strong>{attempt_title}</strong><br><span style="color:#475569;font-size:13px;">Application ref {application_ref}</span></p>
      <ul style="color:#1a1a2e;font-size:14px;">
        <li>{witness_count} witness statement(s) attached</li>
        <li>{evidence_count} evidence item(s) attached</li>
      </ul>
      <p>An adjudicator will begin reviewing witness statements shortly. You'll receive an email when the attempt is approved, rejected, or if any clarification is needed.</p>
      <p>
        <a href="{portal_url}" style="background:#1d4ed8;color:#ffffff;padding:10px 22px;text-decoration:none;border-radius:6px;display:inline-block;margin:10px 0;font-weight:600;">
          Track submission status
        </a>
      </p>
      <p style="font-size:12px;color:#666;">Your submission is now locked — further edits require an adjudicator to re-open it.</p>
    </div>
    """
    text = (
        f"Dear {full_name},\n\n"
        f"Your submission \"{attempt_title}\" (ref {application_ref}) has been received.\n"
        f"  Witnesses: {witness_count}\n  Evidence items: {evidence_count}\n\n"
        f"Track status: {portal_url}\n"
    )
    return await _deliver(to_email, full_name, subject, html, text, dev_hint=f"Submission ack → {to_email}")


async def send_attempt_submitted_to_adjudicator(
    to_email: str,
    full_name: str,
    attempt_title: str,
    application_ref: str,
    organizer_name: str,
    witness_count: int,
    evidence_count: int,
) -> bool:
    """Tell an assigned adjudicator that a new submission is ready to review."""
    subject = f"New submission to review: {attempt_title}"
    portal_url = f"{settings.FRONTEND_URL}/adjudicator/attempts"
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color:#1a1a2e;">New submission ready for adjudication</h2>
      <p>Dear {full_name},</p>
      <p><strong>{organizer_name}</strong> has submitted a new attempt for adjudication:</p>
      <p><strong>{attempt_title}</strong><br><span style="color:#475569;font-size:13px;">Application ref {application_ref}</span></p>
      <ul style="color:#1a1a2e;font-size:14px;">
        <li>{witness_count} witness statement(s) to review</li>
        <li>{evidence_count} evidence item(s) attached</li>
      </ul>
      <p>
        <a href="{portal_url}" style="background:#1d4ed8;color:#ffffff;padding:10px 22px;text-decoration:none;border-radius:6px;display:inline-block;margin:10px 0;font-weight:600;">
          Open review queue
        </a>
      </p>
    </div>
    """
    text = (
        f"Dear {full_name},\n\n"
        f"{organizer_name} submitted \"{attempt_title}\" (ref {application_ref}) for adjudication.\n"
        f"  Witnesses: {witness_count}\n  Evidence items: {evidence_count}\n\n"
        f"Open queue: {portal_url}\n"
    )
    return await _deliver(to_email, full_name, subject, html, text, dev_hint=f"Submission notice → {to_email}")


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
        For the demo environment, use: <span style="font-family:monospace;">witness@gwr.com</span> / <span style="font-family:monospace;">Witness@123</span>.
      </div>
      <p>Please click the button below to sign in. You will be taken directly to this invitation.</p>
      <p>
        <a href="{url}" style="background:#1d4ed8;color:#ffffff;padding:12px 28px;text-decoration:none;border-radius:6px;display:inline-block;margin:16px 0;font-weight:600;">
          Sign in & open invitation
        </a>
      </p>
      <p style="font-size:12px;color:#666;">Or copy this link into your browser:<br><span style="word-break:break-all;">{url}</span></p>
      <p style="font-size:12px;color:#666;">This link expires in {settings.MAGIC_LINK_EXPIRE_HOURS} hours.</p>
      <p style="font-size:12px;color:#666;">If you did not expect this email, please ignore it.</p>
    </div>
    """
