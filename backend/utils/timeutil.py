"""Date/time helpers. Everything uses the APP_TIMEZONE from .env (default Asia/Kolkata)."""
import os
import re
import uuid
from datetime import date, datetime, time
from zoneinfo import ZoneInfo

_now_override = None  # tests can freeze the clock with set_now_override()


def set_now_override(dt):
    global _now_override
    _now_override = dt


def tz() -> ZoneInfo:
    return ZoneInfo(os.getenv("APP_TIMEZONE", "Asia/Kolkata"))


def now() -> datetime:
    return _now_override if _now_override is not None else datetime.now(tz())


def today() -> date:
    return now().date()


_TIME_RE = re.compile(r"^\s*(\d{1,2}):(\d{2})(?::\d{2})?\s*([AaPp][Mm])?\s*$")


def parse_time(value):
    """Accepts '08:00', '8:00', '08:00:00', '8:00 AM'. Returns datetime.time or None."""
    if value is None:
        return None
    m = _TIME_RE.match(str(value))
    if not m:
        return None
    hour, minute, ampm = int(m.group(1)), int(m.group(2)), m.group(3)
    if ampm:
        if not 1 <= hour <= 12:
            return None
        hour = hour % 12 + (12 if ampm.lower() == "pm" else 0)
    if hour > 23 or minute > 59:
        return None
    return time(hour, minute)


def fmt_time(t) -> str:
    return t.strftime("%H:%M") if t else ""


def norm_time(value) -> str:
    return fmt_time(parse_time(value))

def normalize_medicine_time(value, slot: str) -> str:
    """Interpret ambiguous 1-11 hour inputs as PM for afternoon/evening/night."""
    parsed = parse_time(value)
    if parsed is None:
        return ""
    if slot in ("afternoon", "evening", "night") and 1 <= parsed.hour <= 11:
        parsed = parsed.replace(hour=parsed.hour + 12)
    return fmt_time(parsed)


def parse_date(value):
    """Accepts '2026-10-11' or '11/10/2026' (day first). Returns date or None."""
    if value is None:
        return None
    s = str(value).strip()
    if not s:
        return None
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    return None


def at(d: date, t: time) -> datetime:
    return datetime.combine(d, t, tzinfo=tz())


def new_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8].upper()}"


def minutes_of(t: time) -> int:
    return t.hour * 60 + t.minute


def time_from_minutes(total: int) -> str:
    total = max(0, min(total, 23 * 60 + 59))
    return f"{total // 60:02d}:{total % 60:02d}"


_TOKEN_RE = re.compile(r"^(\d{1,3})\s*([dDhH]?)$")


def parse_reminder_tokens(text):
    """'7,1,2h' -> [('days', 7), ('days', 1), ('hours', 2)]. Raises ValueError if invalid."""
    out = []
    for part in re.split(r"[,\s]+", str(text or "").strip()):
        if not part:
            continue
        m = _TOKEN_RE.match(part)
        if not m:
            raise ValueError(f"'{part}' is not a valid reminder")
        kind = "hours" if m.group(2).lower() == "h" else "days"
        out.append((kind, int(m.group(1))))
    return out
