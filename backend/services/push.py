"""
Background (push) reminders.

How it works:
1. The phone subscribes once (the app does this when you tap "Turn on reminders").
   The subscription is saved in the Push_Subscriptions tab.
2. A scheduler calls dispatch_due() every minute (see routes/push.py and app.py).
3. Every reminder that is due is sent ONCE (Notification_Log remembers what was sent).
4. Google's push service holds each message for up to 4 hours (TTL_SECONDS). If the phone is
   offline, it is delivered the moment the phone gets internet again.
"""
import json
import logging
import os
import re
import threading

from services import reminders
from services.store import get_store
from utils import timeutil as tu

log = logging.getLogger("push")
_lock = threading.RLock()

TTL_SECONDS = 4 * 3600      # how long the push service keeps an undelivered message
MAX_AGE_MINUTES = 180       # never push "time for your medicine" if it became due >3 h ago


def configured() -> bool:
    return bool(os.getenv("VAPID_PUBLIC_KEY", "").strip() and os.getenv("VAPID_PRIVATE_KEY", "").strip())


def public_key() -> str:
    return os.getenv("VAPID_PUBLIC_KEY", "").strip()


_SUBJECT_OK = re.compile(r"^(mailto:[^\s@]+@[^\s@]+\.[^\s@]+|https://[^/:\s]+(:\d+)?)$", re.I)


def _subject() -> str:
    raw = os.getenv("VAPID_SUBJECT", "").strip().strip('"').strip("'").strip()
    if raw.upper().startswith("VAPID_SUBJECT="):  # the whole line was pasted by mistake
        raw = raw.split("=", 1)[1].strip().strip('"').strip("'").strip()
    if "@" in raw and not raw.lower().startswith(("mailto:", "http")):
        raw = "mailto:" + raw  # email typed without "mailto:"
    raw = re.sub(r"^mailto:\s+", "mailto:", raw, flags=re.I)  # stray space after "mailto:"
    if not _SUBJECT_OK.match(raw):
        log.warning("VAPID_SUBJECT is not valid (%r). Using a placeholder.", raw)
        return "mailto:admin@example.com"
    return raw


# ------------------------------------------------------------------ subscriptions
def save_subscription(sub: dict, role: str) -> None:
    row = {"endpoint": sub["endpoint"], "p256dh": sub["keys"]["p256dh"], "auth": sub["keys"]["auth"],
           "role": role, "created_at": tu.now().isoformat(timespec="seconds")}
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
    return next((r for r in get_store().read("Push_Subscriptions") if r["endpoint"] == endpoint), None)


# ------------------------------------------------------------------ sending
def _send(sub_row: dict, payload: dict) -> str:
    """Returns 'ok', 'gone' (subscription no longer valid) or 'error'."""
    from pywebpush import WebPushException, webpush

    try:
        webpush(
            subscription_info={"endpoint": sub_row["endpoint"],
                               "keys": {"p256dh": sub_row["p256dh"], "auth": sub_row["auth"]}},
            data=json.dumps(payload),
            vapid_private_key=os.getenv("VAPID_PRIVATE_KEY", "").strip(),
            vapid_claims={"sub": _subject()},
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
    return _send(sub, {"title": "🔔 Test reminder", "body": "Reminders are working on this phone.",
                       "tag": "test", "url": "/"})


def _too_old(n: dict, now_dt) -> bool:
    due = tu.parse_time(n.get("due_at"))
    if due is None:
        return False
    return tu.minutes_of(now_dt.time()) - tu.minutes_of(due) > MAX_AGE_MINUTES


def dispatch_due() -> dict:
    """Send every due reminder that has not been sent yet. Safe to call as often as you like."""
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
            payload = {"title": n["title"], "body": n["message"], "tag": n["id"], "url": "/"}
            results = [(_send(s, payload), s) for s in subs]
            gone = [s for r, s in results if r == "gone"]
            for s in gone:
                store.delete("Push_Subscriptions", "endpoint", s["endpoint"])
            delivered = any(r == "ok" for r, _ in results)
            # Remember it unless every attempt failed for a temporary reason (then retry next minute)
            if delivered or (gone and len(gone) == len(results)):
                store.append("Notification_Log", {"notification_id": n["id"],
                                                  "sent_at": now_dt.isoformat(timespec="seconds")})
                done.add(n["id"])
            sent += 1 if delivered else 0
        return {"configured": True, "subscribers": len(subs), "sent": sent}
