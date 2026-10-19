"""Outbound email via Amazon SES (API-based, using boto3).

The backend task role is granted ses:SendEmail, so no SMTP credentials are
needed. Sending is best-effort: failures are logged and surfaced as a boolean,
never raised into the caller's main flow (a ticket must still be created even
if the confirmation email fails).
"""
import logging
import os

logger = logging.getLogger(__name__)


def _sender() -> str | None:
    return os.getenv("SES_SENDER_EMAIL")


def _region() -> str:
    return os.getenv("SES_REGION", os.getenv("AWS_REGION", "ap-south-1"))


def send_email(to_email: str, subject: str, body_text: str) -> bool:
    """Send a plain-text email via SES. Returns True on success, False otherwise.

    Note: in the SES sandbox, delivery only succeeds to VERIFIED recipients.
    """
    sender = _sender()
    if not sender:
        logger.info("SES_SENDER_EMAIL not configured; skipping email to %s", to_email)
        return False
    try:
        import boto3

        client = boto3.client("ses", region_name=_region())
        client.send_email(
            Source=sender,
            Destination={"ToAddresses": [to_email]},
            Message={
                "Subject": {"Data": subject},
                "Body": {"Text": {"Data": body_text}},
            },
        )
        return True
    except Exception as error:  # noqa: BLE001 - email is best-effort
        logger.warning("Could not send email to %s: %s", to_email, error)
        return False


def send_ticket_confirmation(requester_email: str, requester_name: str, ticket: dict) -> bool:
    subject = f"Support ticket #{ticket.get('id')} received — {ticket.get('title', '')}".strip()
    body = (
        f"Hello {requester_name or 'there'},\n\n"
        f"We've received your support ticket and our team will review it shortly.\n\n"
        f"Ticket ID: #{ticket.get('id')}\n"
        f"Title: {ticket.get('title')}\n"
        f"Category: {ticket.get('category')}\n"
        f"Priority: {ticket.get('priority')}\n"
        f"Status: {ticket.get('status')}\n\n"
        f"You'll receive updates as the team works on your request.\n\n"
        f"— Cloudnaut Support Desk"
    )
    return send_email(requester_email, subject, body)
