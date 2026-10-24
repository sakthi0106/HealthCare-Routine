from pathlib import Path

content = '''"""
Background (push) reminders.

How it works:
1. The phone subscribes once (the app does this when you tap "Turn on reminders").
   The subscription is saved in the Push_Subscriptions tab.
2. A scheduler calls dispatch_due() every minute (see routes/push.py and app.py).
3. Every reminder that is due is sent ONCE (Notification_Log remembers what was sent).
4. The push service may hold undelivered messages for up to TTL_SECONDS, depending on
   the push service and subscription. If the phone is offline, delivery is not guaranteed.
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
MAX_AGE_MINUTES = 180  # Don't send reminders more than 3 hours after they became due.


def configured() -> bool:
    return bool(
        os.getenv("VAPID_PUBLIC_KEY", "").strip()
        and os.getenv("VAPID_PRIVATE_KEY", "").strip()
    )


def public_key() -> str:
    return os.getenv("VAPID_PUBLIC_KEY", "").strip()


def _subject() -> str:
    """Return the VAPID contact subject configured on the hosting environment."""
    subject = os.getenv("VAPID_SUBJECT", "").strip()

    # Require an explicit contact address instead of silently using a placeholder.
    if not subject:
        raise RuntimeError(
            "VAPID_SUBJECT is missing. Set it to 'mailto:your-real-email@example.com' "
            "in the backend environment."
        )

    if not subject.lower().startswith("mailto:") and not subject.lower().startswith("https://"):
        raise RuntimeError(
            "VAPID_SUBJECT must be a mailto: email address or an HTTPS contact URL."
        )

    return subject


# ------------------------------------------------------------------ subscriptions
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
        if any(r["endpoint"] == row["endpoint"] for r in store.read("Push_Subscriptions")):
            store.update("Push_Subscriptions", "endpoint", row["endpoint"], row)
        else:
            store.append("Push_Subscriptions", row)


def remove_subscription(endpoint: str) -> None:
    with _lock:
        get_store().delete("Push_Subscriptions", "endpoint", endpoint)


def find_subscription(endpoint: str):
    return next(
        (r for r in get_store().read("Push_Subscriptions") if r["endpoint"] == endpoint),
        None,
    )


# ------------------------------------------------------------------ sending
def _send(sub_row: dict, payload: dict) -> str:
    """Returns 'ok', 'gone' (subscription no longer valid) or 'error'."""
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
    except WebPushException as e:
        status = getattr(getattr(e, "response", None), "status_code", None)
        if status in (404, 410):
            return "gone"
        body = (getattr(getattr(e, "response", None), "text", "") or "")[:200]
        log.warning("Push send failed (HTTP %s): %s", status, body)
        return "error"
    except Exception:  # noqa: BLE001
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


def _too_old(n: dict, now_dt) -> bool:
    due = tu.parse_time(n.get("due_at"))
    if due is None:
        return False
    return tu.minutes_of(now_dt.time()) - tu.minutes_of(due) > MAX_AGE_MINUTES


def dispatch_due() -> dict:
    """Send due reminders that have not been sent yet; safe to call repeatedly."""
    if not configured():
        return {"configured": False, "sent": 0}

    with _lock:
        store = get_store()
        subs = store.read("Push_Subscriptions")
        if not subs:
            return {"configured": True, "subscribers": 0, "sent": 0}

        done = {r["notification_id"] for r in store.read("Notification_Log")}
        now_dt = tu.now()
        sent = 0

        for n in reminders.get_due_notifications():
            if n["id"] in done or _too_old(n, now_dt):
                continue

            payload = {
                "title": n["title"],
                "body": n["message"],
                "tag": n["id"],
                "url": "/",
            }
            results = [(_send(s, payload), s) for s in subs]
            gone = [s for result, s in results if result == "gone"]

            for s in gone:
                store.delete("Push_Subscriptions", "endpoint", s["endpoint"])

            delivered = any(result == "ok" for result, _ in results)

            # Record the notification if at least one subscriber accepted it,
            # or if all subscriptions are permanently gone.
            if delivered or (gone and len(gone) == len(results)):
                store.append(
                    "Notification_Log",
                    {
                        "notification_id": n["id"],
                        "sent_at": now_dt.isoformat(timespec="seconds"),
                    },
                )
                done.add(n["id"])

            sent += 1 if delivered else 0

        return {"configured": True, "subscribers": len(subs), "sent": sent}
'''

path = Path("/mnt/data/push.py")
path.write_text(content, encoding="utf-8")
print(f"Created updated file: {path}")
