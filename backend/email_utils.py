"""
Sends task notification emails through Gmail.

We use Gmail's SMTP server with an "App Password" rather than the full
Gmail API OAuth flow. This satisfies the "integrate Gmail" requirement
with far less setup (no Google Cloud OAuth consent screen needed just
for email) and is a legitimate, commonly used approach for
transactional email from a backend service. Be ready to explain this
trade-off in the interview: the Gmail API route would let you send
"on behalf of" a logged-in user, but for a service that always sends
from one fixed inbox, SMTP + app password is simpler and just as
secure.
"""
import os
import smtplib
from email.mime.text import MIMEText

GMAIL_ADDRESS = os.environ.get("GMAIL_ADDRESS")
GMAIL_APP_PASSWORD = os.environ.get("GMAIL_APP_PASSWORD")


def send_email(to_address: str, subject: str, body: str):
    if not GMAIL_ADDRESS or not GMAIL_APP_PASSWORD:
        print("Gmail credentials not set — skipping email send.")
        return

    msg = MIMEText(body)
    msg["Subject"] = subject
    msg["From"] = GMAIL_ADDRESS
    msg["To"] = to_address

    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
        server.login(GMAIL_ADDRESS, GMAIL_APP_PASSWORD)
        server.sendmail(GMAIL_ADDRESS, [to_address], msg.as_string())


def notify_task_created(assignee_email: str, task_title: str, creator_email: str):
    send_email(
        assignee_email,
        f"New task assigned: {task_title}",
        f"{creator_email} assigned you a new task:\n\n{task_title}\n\n"
        f"Log in to the task manager to view details.",
    )


def notify_task_completed(creator_email: str, task_title: str, completer_email: str):
    send_email(
        creator_email,
        f"Task completed: {task_title}",
        f"{completer_email} marked the task '{task_title}' as completed.",
    )
