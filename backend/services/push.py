
"""
Background (push) reminders.

How it works:
1. The phone subscribes when the user enables reminders.
2. The subscription is saved in the Push_Subscriptions tab.
3. dispatch_due() is called periodically by the scheduler.
4. Notification_Log prevents successfully sent notifications from being sent again.
"""
import json
import logging
import os
import threading

from services import reminders
from services.store import get_store
from utils import timeutil as tu

log = logging.getLogger("push")
_lock = threading.RLock()

TTL_SECONDS = 4 * 3600
MAX_AGE_MINUTES = 180


def configured() -> bool:
    return bool(
        os.getenv("VAPID_PUBLIC_KEY", "").strip()
        and os.getenv("VAPID_PRIVATE_KEY", "").strip()
    )


def public_key() -> str:
    return os.getenv("VAPID_PUBLIC_KEY", "").strip()


def _subject() -> str:
    """Return the VAPID contact subject configured in the environment."""
    subject = os.getenv("VAPID_SUBJECT", "").strip()

    if not subject:
        raise RuntimeError(
            "VAPID_SUBJECT is missing. Configure it in the Render environment."
        )

    if not (
        subject.lower().startswith("mailto:")
        or subject.lower().startswith("https://")
    ):
        raise RuntimeError(
            "VAPID_SUBJECT must be a mailto: email or HTTPS contact URL."
        )

    return subject


# ------------------------------------------------------------------
# Subscriptions
# ------------------------------------------------------------------

def save_subscription(sub: dict, role: str) -> None:
    row = {
        "endpoint": sub["endpoint"],
        "p256dh": sub["keys"]["p256dh"],
        "auth": sub["keys"]["auth"],
        "role": role,
        "created_at": tu.now().isoformat(timespec="seconds"),
    }

    with _lock:
        store = get_store()
        existing = any(
            r["endpoint"] == row["endpoint"]
            for r in store.read("Push_Subscriptions")
        )

        if existing:
            store.update(
                "Push_Subscriptions", "endpoint", row["endpoint"], row
            )
        else:
            store.append("Push_Subscriptions", row)


def remove_subscription(endpoint: str) -> None:
    with _lock:
        get_store().delete("Push_Subscriptions", "endpoint", endpoint)


def find_subscription(endpoint: str):
    return next(
        (
            r for r in get_store().read("Push_Subscriptions")
            if r["endpoint"] == endpoint
        ),
        None,
    )


# ------------------------------------------------------------------
# Sending push notifications
# ------------------------------------------------------------------

def _send(sub_row: dict, payload: dict) -> str:
    """Return 'ok', 'gone' for expired subscriptions, or 'error'."""
    from pywebpush import WebPushException, webpush

    try:
        subject = _subject()
        private_key = os.getenv("VAPID_PRIVATE_KEY", "").strip()

        if not private_key:
            raise RuntimeError("VAPID_PRIVATE_KEY is not configured.")

        webpush(
            subscription_info={
                "endpoint": sub_row["endpoint"],
                "keys": {
                    "p256dh": sub_row["p256dh"],
                    "auth": sub_row["auth"],
                },
            },
            data=json.dumps(payload),
            vapid_private_key=private_key,
            vapid_claims={"sub": subject},
            ttl=TTL_SECONDS,
            headers={"Urgency": "high"},
        )

        return "ok"

    except WebPushException as exc:
        status = getattr(
            getattr(exc, "response", None), "status_code", None
        )

        if status in (404, 410):
            return "gone"

        body = (
            getattr(getattr(exc, "response", None), "text", "") or ""
        )[:200]

        log.warning("Push send failed (HTTP %s): %s", status, body)
        return "error"

    except Exception:
        log.exception("Push send crashed")
        return "error"


def send_test(endpoint: str) -> str:
    sub = find_subscription(endpoint)

    if sub is None:
        return "unknown"

    return _send(
        sub,
        {
            "title": "🔔 Test reminder",
            "body": "Reminders are working on this phone.",
            "tag": "test",
            "url": "/",
        },
    )


# ------------------------------------------------------------------
# Reminder dispatch
# ------------------------------------------------------------------

def _too_old(n: dict, now_dt) -> bool:
    due = tu.parse_time(n.get("due_at"))

    if due is None:
        return False

    return (
        tu.minutes_of(now_dt.time()) - tu.minutes_of(due)
        > MAX_AGE_MINUTES
    )


def dispatch_due() -> dict:
    """Send due reminders that have not already been logged."""
    if not configured():
        return {"configured": False, "sent": 0}

    with _lock:
        store = get_store()
        subs = store.read("Push_Subscriptions")

        if not subs:
            return {
                "configured": True,
                "subscribers": 0,
                "sent": 0,
            }

        done = {
            r["notification_id"]
            for r in store.read("Notification_Log")
        }

        now_dt = tu.now()
        sent = 0

        for notification in reminders.get_due_notifications():
            notification_id = notification["id"]

            if notification_id in done or _too_old(notification, now_dt):
                continue

            payload = {
                "title": notification["title"],
                "body": notification["message"],
                "tag": notification_id,
                "url": "/",
            }

            results = [
                (_send(sub, payload), sub)
                for sub in subs
            ]

            gone = [
                sub for result, sub in results
                if result == "gone"
            ]

            for sub in gone:
                store.delete(
                    "Push_Subscriptions", "endpoint", sub["endpoint"]
                )

            delivered = any(
                result == "ok" for result, _ in results
            )

            # Log only after successful delivery acceptance or when all
            # subscriptions have permanently expired.
            all_gone = bool(results) and len(gone) == len(results)

            if delivered or all_gone:
                store.append(
                    "Notification_Log",
                    {
                        "notification_id": notification_id,
                        "sent_at": now_dt.isoformat(timespec="seconds"),
                    },
                )
                done.add(notification_id)

            if delivered:
                sent += 1

        return {
            "configured": True,
            "subscribers": len(subs),
            "sent": sent,
        }
