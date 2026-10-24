"""
Notification service.

How it works today: the app asks GET /api/notifications/due every minute, and the
frontend shows each new notification once (browser/PWA notification + in-app banner).

How to add WhatsApp / SMS / email later: write a class like WhatsAppChannel below,
add it to CHANNELS, and call dispatch() from a scheduled job (e.g. a cron that runs
every minute). Nothing else needs to change.
"""
import logging
from datetime import timedelta

from services import google_sheets as sheets
from services import inventory
from utils import timeutil as tu

log = logging.getLogger("reminders")

MEDICINE_REMINDER = "MEDICINE_REMINDER"
WATER_REMINDER = "WATER_REMINDER"
WALKING_REMINDER = "WALKING_REMINDER"
RESPIROMETER_REMINDER = "RESPIROMETER_REMINDER"
APPOINTMENT_REMINDER = "APPOINTMENT_REMINDER"
LOW_STOCK_ALERT = "LOW_STOCK_ALERT"


def _n(id_, type_, icon, title, message, due_at=None) -> dict:
    n = {"id": id_, "type": type_, "title": f"{icon} {title}", "message": message}
    if due_at:
        n["due_at"] = due_at  # "HH:MM" - when it became due today
    return n


def get_due_notifications() -> list:
    s = sheets.get_settings()
    if not s["notification_enabled"]:
        return []
    now_dt = tu.now()
    today = now_dt.date()
    now_hm = tu.fmt_time(now_dt.time())
    out = []

    if s["notify_medicine"]:
        for d in sheets.get_today_medicine_schedule():
            if d["state"] == "due":
                out.append(_n(f"med-{d['log_id']}-{d['snooze_until'] or 'base'}", MEDICINE_REMINDER, "💊",
                              "Medicine Reminder",
                              f"It is time for your {d['slot']} medicine: {d['medicine_name']}."))

    if s["notify_respirometer"]:
        for r in sheets.get_respirometer_schedule():
            if r["state"] == "due":
                out.append(_n(f"resp-{r['log_id']}-{r['snooze_until'] or 'base'}", RESPIROMETER_REMINDER, "🫁",
                              "Respirometer Reminder", "Your scheduled respirometer session is due."))

    if s["notify_water"] and s["water_reminder_enabled"]:
        start, end = tu.parse_time(s["water_reminder_start_time"]), tu.parse_time(s["water_reminder_end_time"])
        gap = s["water_reminder_interval_minutes"]
        if start and end and tu.minutes_of(start) <= tu.minutes_of(now_dt.time()) <= tu.minutes_of(end):
            bucket = (tu.minutes_of(now_dt.time()) - tu.minutes_of(start)) // gap
            water = sheets.get_water_today()
            if water["total_ml"] < water["target_ml"]:
                out.append(_n(f"water-{today}-{bucket}", WATER_REMINDER, "💧", "Water Reminder",
                              f"Time for some water. You have had {water['total_ml']} ml of {water['target_ml']} ml today."))

    if s["notify_walking"] and now_hm >= s["walking_reminder_time"]:
        walk = sheets.get_walking_today()
        if walk["total_minutes"] < max(s["walking_target_minutes"], 1):
            out.append(_n(f"walk-{today}", WALKING_REMINDER, "🚶", "Walking Reminder",
                          "It is a good time for your walk today."))

    if s["notify_appointments"]:
        out += _appointment_notifications(now_dt, s)

    if s["notify_low_stock"]:
        for item in inventory.get_low_stock_medicines():
            out.append(_n(f"stock-{item['medicine_id']}-{today}-{item['state']}", LOW_STOCK_ALERT, "⚠️",
                          "Medicine Stock Alert", item["alert"]))
    return out


def _appointment_notifications(now_dt, settings) -> list:
    out = []
    for a in sheets.get_appointments(upcoming_only=True):
        try:
            tokens = tu.parse_reminder_tokens(a["reminder_days"] or settings["appointment_reminder_days"])
        except ValueError:
            continue
        appt_dt = tu.at(tu.parse_date(a["date"]), tu.parse_time(a["time"]))
        triggers = []
        for kind, amount in tokens:
            if kind == "hours":
                triggers.append((appt_dt - timedelta(hours=amount), f"{amount}h"))
            else:
                day = tu.parse_date(a["date"]) - timedelta(days=amount)
                triggers.append((tu.at(day, tu.parse_time("09:00")), f"{amount}d"))
        reached = [t for t in triggers if t[0] <= now_dt]
        if not reached:
            continue
        _when, token = max(reached)  # only the most recent reminder, not every older one
        what = a["purpose"] or a["department"] or "appointment"
        who = f" with {a['doctor']}" if a["doctor"] else ""
        out.append(_n(f"appt-{a['appointment_id']}-{token}", APPOINTMENT_REMINDER, "🏥", "Appointment Reminder",
                      f"{what}{who} on {a['date']} at {a['time']}."))
    return out


# ---- delivery channels (only the browser one exists today) ----
class NotificationChannel:
    def send(self, notification: dict) -> None:
        raise NotImplementedError


class BrowserChannel(NotificationChannel):
    """The frontend polls and shows notifications itself, so there is nothing to push here."""

    def send(self, notification: dict) -> None:
        return None


class WhatsAppChannel(NotificationChannel):  # placeholder for later
    def send(self, notification: dict) -> None:
        raise NotImplementedError("WhatsApp delivery is not built yet.")


CHANNELS = [BrowserChannel()]


def dispatch() -> None:
    for n in get_due_notifications():
        for channel in CHANNELS:
            try:
                channel.send(n)
            except Exception:  # noqa: BLE001
                log.exception("Channel failed")
