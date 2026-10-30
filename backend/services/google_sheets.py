"""
All data functions for the app. Every read/write goes through services/store.py,
so nothing here talks to Google directly and nothing is ever called from the browser.
"""
import re
import threading
from datetime import timedelta

from models.schema import DEFAULT_SETTINGS
from services.store import get_store
from utils import timeutil as tu
from utils.errors import AppError

_lock = threading.RLock()  # protects "check, then write" sequences

SLOTS = (
    ("morning", "morning_time"),
    ("afternoon", "afternoon_time"),
    ("evening", "evening_time"),
    ("night", "night_time"),
)
_SNOOZE_RE = re.compile(r"snooze_until=(\d{2}:\d{2})")


# ------------------------------------------------------------------ helpers
def _num(value, default=0):
    try:
        f = float(str(value).strip())
    except ValueError:
        return default
    return int(f) if f == int(f) else round(f, 2)


def _fmt_num(value) -> str:
    return str(int(value)) if float(value) == int(value) else str(round(float(value), 2))


def _bool(value, default=True) -> bool:
    s = str(value).strip().lower()
    return default if s == "" else s in ("true", "1", "yes", "y")


def _not_future(d):
    if d > tu.today():
        raise AppError("The date cannot be in the future.", 400)


def _slot_for_time(hhmm: str) -> str:
    hour = int(hhmm[:2]) if hhmm else 0
    return "morning" if hour < 12 else "afternoon" if hour < 16 else "evening" if hour < 20 else "night"


# ------------------------------------------------------------------ medicines
def _med_from_row(r) -> dict:
    times = {key: tu.normalize_medicine_time(r.get(key, ""), slot) for slot, key in SLOTS}
    n = sum(1 for v in times.values() if v)
    daily = _num(r["daily_quantity"])
    s, e = tu.parse_date(r["start_date"]), tu.parse_date(r["end_date"])
    return {
        "medicine_id": r["medicine_id"],
        "medicine_name": r["medicine_name"],
        "generic_name": r["generic_name"],
        "dosage": r["dosage"],
        "frequency": r["frequency"],
        **times,
        "daily_quantity": daily,
        "dose_quantity": _num(daily / n) if n else daily,
        "current_stock": _num(r["current_stock"]),
        "reorder_level": _num(r["reorder_level"]),
        "start_date": s.isoformat() if s else "",
        "end_date": e.isoformat() if e else "",
        "active": _bool(r["active"]),
        "interval_days": max(1, int(_num(r.get("interval_days", ""), 1) or 1)),   # blank = every day
        "notes": r["notes"],
    }


def get_medicines(include_inactive: bool = True) -> list:
    meds = [_med_from_row(r) for r in get_store().read("Medicines") if r["medicine_id"]]
    return meds if include_inactive else [m for m in meds if m["active"]]


def get_medicine(medicine_id: str) -> dict:
    for m in get_medicines():
        if m["medicine_id"] == medicine_id:
            return m
    raise AppError("That medicine could not be found.", 404)


def _med_row(data: dict) -> dict:
    row = {k: ("" if v is None else str(v)) for k, v in data.items()}
    for k in ("daily_quantity", "current_stock", "reorder_level"):
        if k in data and data[k] is not None:
            row[k] = _fmt_num(data[k])
    if "active" in data and data["active"] is not None:
        row["active"] = "TRUE" if data["active"] else "FALSE"
    return row


def add_medicine(data: dict) -> dict:
    with _lock:
        rows = get_store().read("Medicines")
        nums = [int(m.group(1)) for r in rows if (m := re.match(r"MED-(\d+)$", r["medicine_id"]))]
        new_id = f"MED-{(max(nums) + 1 if nums else 1):03d}"
        get_store().append("Medicines", {"medicine_id": new_id, **_med_row(data)})
        return get_medicine(new_id)


def update_medicine(medicine_id: str, updates: dict) -> dict:
    with _lock:
        current = get_medicine(medicine_id)
        clean = {k: v for k, v in updates.items() if v is not None}
        merged = {**current, **clean}
        if merged["start_date"] and merged["end_date"] and merged["end_date"] < merged["start_date"]:
            raise AppError("The end date cannot be before the start date.", 400)
        if merged.get("interval_days", 1) > 1 and not merged["start_date"]:
            raise AppError("Choose the start date (the first day you take it) when it is not taken every day.", 400)
        if clean:
            get_store().update("Medicines", "medicine_id", medicine_id, _med_row(clean))
        return get_medicine(medicine_id)


def delete_medicine(medicine_id: str) -> None:
    with _lock:
        get_medicine(medicine_id)
        get_store().delete("Medicines", "medicine_id", medicine_id)


def _scheduled_on(med: dict, d) -> bool:
    if not med["active"]:
        return False
    s, e = tu.parse_date(med["start_date"]), tu.parse_date(med["end_date"])
    if (s and d < s) or (e and d > e):
        return False
    n = med.get("interval_days", 1)
    if n > 1 and s:                       # alternate days etc.: counted from the start date
        return (d - s).days % n == 0
    return True


def _slots_of(med: dict) -> list:
    return [(name, med[key]) for name, key in SLOTS if med[key]]


# ------------------------------------------------------------------ dose schedule
def _state(status, scheduled, snooze_until, d, now_dt) -> str:
    if status in ("Taken", "Completed"):
        return "taken" if status == "Taken" else "completed"
    if status == "Skipped":
        return "skipped"
    if d < now_dt.date():
        return "missed"
    now_hm = tu.fmt_time(now_dt.time())
    if status == "Snoozed" and snooze_until and now_hm < snooze_until:
        return "snoozed"
    if status == "Snoozed":
        return "due"
    return "due" if scheduled <= now_hm else "upcoming"


def _dose_out(r, med, slot, d, now_dt) -> dict:
    m = _SNOOZE_RE.search(r["notes"] or "")
    snooze_until = m.group(1) if m else ""
    sched = tu.norm_time(r["scheduled_time"])
    return {
        "log_id": r["log_id"],
        "date": d.isoformat(),
        "medicine_id": r["medicine_id"],
        "medicine_name": r["medicine_name"] or (med["medicine_name"] if med else ""),
        "dosage": med["dosage"] if med else "",
        "slot": slot,
        "scheduled_time": sched,
        "status": r["status"] or "Pending",
        "taken_time": tu.norm_time(r["taken_time"]),
        "snooze_until": snooze_until,
        "state": _state(r["status"] or "Pending", sched, snooze_until, d, now_dt),
    }

def get_today_medicine_schedule(d=None) -> list:
    """Today's doses. Missing log rows (status Pending) are created the first time they are needed."""
    d = d or tu.today()
    now_dt = tu.now()
    with _lock:
        store = get_store()
        meds = get_medicines()
        by_id = {m["medicine_id"]: m for m in meds}
        wanted = {}
        for m in meds:
            if _scheduled_on(m, d):
                for slot, t in _slots_of(m):
                    wanted[(m["medicine_id"], t)] = slot

        logs = [r for r in store.read("Medicine_Log") if tu.parse_date(r["date"]) == d]
        have = {(r["medicine_id"], tu.norm_time(r["scheduled_time"])) for r in logs}
        new = []
        for (mid, t), _slot in wanted.items():
            if (mid, t) not in have:
                new.append({
                    "log_id": tu.new_id("MLOG"), "date": d.isoformat(), "medicine_id": mid,
                    "medicine_name": by_id[mid]["medicine_name"], "scheduled_time": t,
                    "status": "Pending", "taken_time": "", "notes": "",
                })
        if new:
            store.append_many("Medicine_Log", new)
            logs += new

        items = []
        for r in logs:
            key = (r["medicine_id"], tu.norm_time(r["scheduled_time"]))
            status = r["status"] or "Pending"
            if status == "Pending" and key not in wanted:
                continue  # schedule changed since the row was created
            med = by_id.get(r["medicine_id"])
            slot = wanted.get(key)
            if slot is None and med:
                slot = next((n for n, t in _slots_of(med) if t == key[1]), None)
            items.append(_dose_out(r, med, slot or _slot_for_time(key[1]), d, now_dt))
        items.sort(key=lambda i: (i["scheduled_time"], i["medicine_name"]))
        return items


def summarize_doses(items: list) -> dict:
    return {
        "total": len(items),
        "taken": sum(1 for i in items if i["status"] == "Taken"),
        "skipped": sum(1 for i in items if i["status"] == "Skipped"),
        "pending": sum(1 for i in items if i["status"] in ("Pending", "Snoozed")),
    }


def _find_dose(medicine_id, log_id, scheduled_time) -> dict:
    get_medicine(medicine_id)  # 404 if the medicine does not exist
    candidates = [i for i in get_today_medicine_schedule() if i["medicine_id"] == medicine_id]
    if log_id:
        pick = next((i for i in candidates if i["log_id"] == log_id), None)
    elif scheduled_time:
        pick = next((i for i in candidates if i["scheduled_time"] == scheduled_time), None)
    else:
        open_ = [i for i in candidates if i["status"] in ("Pending", "Snoozed")]
        pick = next((i for i in open_ if i["state"] in ("due", "snoozed")), None) or (open_[0] if open_ else None)
    if pick is None:
        raise AppError("We could not find that dose for today.", 404)
    return pick


def record_medicine_taken(medicine_id, log_id=None, scheduled_time=None) -> dict:
    with _lock:
        dose = _find_dose(medicine_id, log_id, scheduled_time)
        med = get_medicine(medicine_id)
        if dose["status"] == "Taken":  # tapping twice must never deduct stock twice
            return {"dose": dose, "already_recorded": True, "current_stock": med["current_stock"]}
        taken_time = tu.fmt_time(tu.now().time())
        get_store().update("Medicine_Log", "log_id", dose["log_id"],
                           {"status": "Taken", "taken_time": taken_time, "notes": ""})
        stock = med["current_stock"]
        if med["dose_quantity"] > 0:
            stock = max(0, stock - med["dose_quantity"])  # stock can never go below zero
            get_store().update("Medicines", "medicine_id", medicine_id, {"current_stock": _fmt_num(stock)})
        dose.update(status="Taken", taken_time=taken_time, state="taken", snooze_until="")
        return {"dose": dose, "already_recorded": False, "current_stock": stock}


def record_medicine_skipped(medicine_id, log_id=None, scheduled_time=None) -> dict:
    with _lock:
        dose = _find_dose(medicine_id, log_id, scheduled_time)
        if dose["status"] == "Taken":
            raise AppError("This dose is already marked as taken.", 400)
        get_store().update("Medicine_Log", "log_id", dose["log_id"], {"status": "Skipped", "notes": ""})
        dose.update(status="Skipped", state="skipped", snooze_until="")
        return {"dose": dose}


def record_medicine_snoozed(medicine_id, log_id=None, scheduled_time=None, minutes=None) -> dict:
    with _lock:
        dose = _find_dose(medicine_id, log_id, scheduled_time)
        if dose["status"] in ("Taken", "Skipped"):
            raise AppError("This dose has already been recorded.", 400)
        minutes = minutes or get_settings()["medicine_snooze_minutes"]
        until = tu.time_from_minutes(tu.minutes_of(tu.now().time()) + minutes)
        get_store().update("Medicine_Log", "log_id", dose["log_id"],
                           {"status": "Snoozed", "notes": f"snooze_until={until}"})
        dose.update(status="Snoozed", state="snoozed", snooze_until=until)
        return {"dose": dose}


# ------------------------------------------------------------------ water
def _water_out(r) -> dict:
    return {"log_id": r["log_id"], "date": r["date"], "time": tu.norm_time(r["time"]),
            "amount_ml": int(_num(r["amount_ml"]))}


def get_water_logs(start, end) -> list:
    return [_water_out(r) for r in get_store().read("Water_Log")
            if (d := tu.parse_date(r["date"])) and start <= d <= end]


def get_water_today() -> dict:
    d = tu.today()
    entries = sorted(get_water_logs(d, d), key=lambda e: e["time"])
    total = sum(e["amount_ml"] for e in entries)
    target = get_settings()["water_target_ml"]
    return {"date": d.isoformat(), "total_ml": total, "target_ml": target,
            "percent": min(100, round(total * 100 / target)) if target else 0, "entries": entries}


def add_water(amount_ml, date_str=None, time_str=None) -> dict:
    d = tu.parse_date(date_str) if date_str else tu.today()
    _not_future(d)
    get_store().append("Water_Log", {
        "log_id": tu.new_id("WAT"), "date": d.isoformat(),
        "time": time_str or tu.fmt_time(tu.now().time()), "amount_ml": str(int(amount_ml)),
    })
    return get_water_today()


# ------------------------------------------------------------------ walking
def _walk_out(r) -> dict:
    return {"log_id": r["log_id"], "date": r["date"], "start_time": tu.norm_time(r["start_time"]),
            "duration_minutes": _num(r["duration_minutes"]), "distance_km": _num(r["distance_km"]),
            "notes": r["notes"]}


def get_walking_logs(start, end) -> list:
    return [_walk_out(r) for r in get_store().read("Walking_Log")
            if (d := tu.parse_date(r["date"])) and start <= d <= end]


def get_walking_today() -> dict:
    d = tu.today()
    entries = sorted(get_walking_logs(d, d), key=lambda e: e["start_time"])
    s = get_settings()
    return {"date": d.isoformat(), "total_minutes": _num(sum(e["duration_minutes"] for e in entries)),
            "total_km": _num(sum(e["distance_km"] for e in entries)),
            "target_minutes": s["walking_target_minutes"], "target_km": s["walking_target_distance"],
            "entries": entries}


def add_walking(date_str=None, start_time=None, end_time=None, duration_minutes=None,
                distance_km=0, notes="") -> dict:
    d = tu.parse_date(date_str) if date_str else tu.today()
    _not_future(d)
    duration = duration_minutes or 0
    if not duration and start_time and end_time:
        duration = tu.minutes_of(tu.parse_time(end_time)) - tu.minutes_of(tu.parse_time(start_time))
        if duration <= 0:
            raise AppError("The end time must be after the start time.", 400)
    if duration <= 0:
        raise AppError("Please enter how long you walked, or a start and end time.", 400)
    get_store().append("Walking_Log", {
        "log_id": tu.new_id("WLK"), "date": d.isoformat(), "start_time": start_time or "",
        "duration_minutes": _fmt_num(duration), "distance_km": _fmt_num(distance_km or 0), "notes": notes or "",
    })
    return get_walking_today()


# ------------------------------------------------------------------ respirometer
def respirometer_times(settings=None) -> list:
    s = settings or get_settings()
    start, end = tu.parse_time(s["respirometer_start_time"]), tu.parse_time(s["respirometer_end_time"])
    if not start or not end:
        return []
    a, b = tu.minutes_of(start), tu.minutes_of(end)
    if b < a:
        return []
    freq, sessions = s["respirometer_frequency"], s["respirometer_sessions"]
    if freq > 0:
        mins = list(range(a, b + 1, freq))[:48]
        if sessions > 0:
            mins = mins[:sessions]
    elif sessions > 0:
        mins = [a] if sessions == 1 else [round(a + i * (b - a) / (sessions - 1)) for i in range(sessions)]
    else:
        mins = []
    return [tu.time_from_minutes(m) for m in mins]


def _resp_out(r, d, now_dt) -> dict:
    m = _SNOOZE_RE.search(r["notes"] or "")
    until = m.group(1) if m else ""
    sched = tu.norm_time(r["scheduled_time"])
    return {"log_id": r["log_id"], "date": d.isoformat(), "scheduled_time": sched,
            "completed_time": tu.norm_time(r["completed_time"]), "status": r["status"] or "Pending",
            "snooze_until": until, "state": _state(r["status"] or "Pending", sched, until, d, now_dt)}


def get_respirometer_schedule(d=None) -> list:
    d = d or tu.today()
    now_dt = tu.now()
    with _lock:
        store = get_store()
        wanted = set(respirometer_times())
        logs = [r for r in store.read("Respirometer_Log") if tu.parse_date(r["date"]) == d]
        have = {tu.norm_time(r["scheduled_time"]) for r in logs}
        new = [{"log_id": tu.new_id("RSP"), "date": d.isoformat(), "scheduled_time": t,
                "completed_time": "", "status": "Pending", "notes": ""} for t in sorted(wanted - have)]
        if new:
            store.append_many("Respirometer_Log", new)
            logs += new
        items = [_resp_out(r, d, now_dt) for r in logs
                 if (r["status"] or "Pending") != "Pending" or tu.norm_time(r["scheduled_time"]) in wanted]
        return sorted(items, key=lambda i: i["scheduled_time"])


def summarize_sessions(items: list) -> dict:
    nxt = next((i for i in items if i["status"] in ("Pending", "Snoozed")), None)
    return {"total": len(items), "completed": sum(1 for i in items if i["status"] == "Completed"),
            "skipped": sum(1 for i in items if i["status"] == "Skipped"), "next": nxt}


def _find_session(log_id) -> dict:
    row = next((r for r in get_store().read("Respirometer_Log") if r["log_id"] == log_id), None)
    if row is None:
        raise AppError("We could not find that session.", 404)
    return _resp_out(row, tu.parse_date(row["date"]) or tu.today(), tu.now())


def record_respirometer_completion(log_id) -> dict:
    with _lock:
        item = _find_session(log_id)
        if item["status"] == "Completed":
            return item
        t = tu.fmt_time(tu.now().time())
        get_store().update("Respirometer_Log", "log_id", log_id, {"status": "Completed", "completed_time": t, "notes": ""})
        item.update(status="Completed", completed_time=t, state="completed", snooze_until="")
        return item


def record_respirometer_skipped(log_id) -> dict:
    with _lock:
        item = _find_session(log_id)
        if item["status"] == "Completed":
            raise AppError("This session is already marked as completed.", 400)
        get_store().update("Respirometer_Log", "log_id", log_id, {"status": "Skipped", "notes": ""})
        item.update(status="Skipped", state="skipped")
        return item


def record_respirometer_snoozed(log_id, minutes=None) -> dict:
    with _lock:
        item = _find_session(log_id)
        if item["status"] in ("Completed", "Skipped"):
            raise AppError("This session has already been recorded.", 400)
        minutes = minutes or get_settings()["respirometer_snooze_minutes"]
        until = tu.time_from_minutes(tu.minutes_of(tu.now().time()) + minutes)
        get_store().update("Respirometer_Log", "log_id", log_id, {"status": "Snoozed", "notes": f"snooze_until={until}"})
        item.update(status="Snoozed", state="snoozed", snooze_until=until)
        return item


# ------------------------------------------------------------------ appointments
def _appt_out(r) -> dict:
    return {"appointment_id": r["appointment_id"], "date": (tu.parse_date(r["date"]) or tu.today()).isoformat(),
            "time": tu.norm_time(r["time"]), "doctor": r["doctor"], "hospital": r["hospital"],
            "department": r["department"], "purpose": r["purpose"],
            "reminder_days": r["reminder_days"] or "", "status": r["status"] or "Scheduled", "notes": r["notes"]}


def get_appointments(upcoming_only: bool = False) -> list:
    items = [_appt_out(r) for r in get_store().read("Appointments") if r["appointment_id"]]
    if upcoming_only:
        now_dt = tu.now()
        items = [a for a in items if a["status"] == "Scheduled"
                 and tu.at(tu.parse_date(a["date"]), tu.parse_time(a["time"]) or tu.parse_time("00:00")) >= now_dt]
    return sorted(items, key=lambda a: (a["date"], a["time"]))


def get_appointment(appointment_id) -> dict:
    for a in get_appointments():
        if a["appointment_id"] == appointment_id:
            return a
    raise AppError("That appointment could not be found.", 404)


def add_appointment(data: dict) -> dict:
    with _lock:
        new_id = tu.new_id("APT")
        get_store().append("Appointments", {"appointment_id": new_id, **{k: str(v) for k, v in data.items()}})
        return get_appointment(new_id)


def update_appointment(appointment_id, updates: dict) -> dict:
    with _lock:
        get_appointment(appointment_id)
        clean = {k: str(v) for k, v in updates.items() if v is not None}
        if clean:
            get_store().update("Appointments", "appointment_id", appointment_id, clean)
        return get_appointment(appointment_id)


def delete_appointment(appointment_id) -> None:
    with _lock:
        get_appointment(appointment_id)
        get_store().delete("Appointments", "appointment_id", appointment_id)


# ------------------------------------------------------------------ stock & purchases
def get_medicine_stock() -> list:
    return [{"medicine_id": m["medicine_id"], "medicine_name": m["medicine_name"], "active": m["active"],
             "current_stock": m["current_stock"], "reorder_level": m["reorder_level"],
             "daily_quantity": m["daily_quantity"]} for m in get_medicines()]


def add_medicine_purchase(medicine_id, quantity, date_str=None, notes="") -> dict:
    with _lock:
        med = get_medicine(medicine_id)
        d = tu.parse_date(date_str) if date_str else tu.today()
        _not_future(d)
        new_stock = med["current_stock"] + quantity
        get_store().append("Medicine_Purchases", {
            "purchase_id": tu.new_id("PUR"), "date": d.isoformat(), "medicine_id": medicine_id,
            "medicine_name": med["medicine_name"], "quantity_added": _fmt_num(quantity), "notes": notes or ""})
        get_store().update("Medicines", "medicine_id", medicine_id, {"current_stock": _fmt_num(new_stock)})
        return {"medicine_id": medicine_id, "medicine_name": med["medicine_name"], "current_stock": _num(new_stock)}


def get_purchases(limit: int = 50) -> list:
    rows = get_store().read("Medicine_Purchases")
    out = [{"purchase_id": r["purchase_id"], "date": r["date"], "medicine_id": r["medicine_id"],
            "medicine_name": r["medicine_name"], "quantity_added": _num(r["quantity_added"]), "notes": r["notes"]}
           for r in rows]
    return sorted(out, key=lambda p: p["date"], reverse=True)[:limit]


# ------------------------------------------------------------------ settings
def _v_int(lo, hi):
    def check(v):
        try:
            n = int(float(v))
        except (TypeError, ValueError):
            raise ValueError("must be a whole number")
        if not lo <= n <= hi:
            raise ValueError(f"must be between {lo} and {hi}")
        return str(n)
    return check


def _v_float(lo, hi):
    def check(v):
        try:
            n = float(v)
        except (TypeError, ValueError):
            raise ValueError("must be a number")
        if not lo <= n <= hi:
            raise ValueError(f"must be between {lo} and {hi}")
        return _fmt_num(n)
    return check


def _v_time(v):
    if tu.parse_time(v) is None:
        raise ValueError("must be a time like 08:00")
    return tu.norm_time(v)


def _v_bool(v):
    if isinstance(v, bool):
        return "true" if v else "false"
    if str(v).strip().lower() in ("true", "false"):
        return str(v).strip().lower()
    raise ValueError("must be on or off")


def _v_text(n):
    return lambda v: str(v).strip()[:n]


def _v_reminders(v):
    tu.parse_reminder_tokens(v)
    return str(v).strip()


def _v_sessions(v):
    return "" if str(v).strip() == "" else _v_int(0, 48)(v)


SETTING_VALIDATORS = {
    "father_name": _v_text(60),
    "water_target_ml": _v_int(100, 10000),
    "walking_target_minutes": _v_float(0, 600),
    "walking_target_distance": _v_float(0, 100),
    "respirometer_start_time": _v_time,
    "respirometer_end_time": _v_time,
    "respirometer_frequency": _v_int(0, 720),
    "respirometer_sessions": _v_sessions,
    "respirometer_snooze_minutes": _v_int(1, 240),
    "medicine_snooze_minutes": _v_int(1, 240),
    "appointment_reminder_days": _v_reminders,
    "water_reminder_interval_minutes": _v_int(15, 720),
    "water_reminder_start_time": _v_time,
    "water_reminder_end_time": _v_time,
    "walking_reminder_time": _v_time,
    **{k: _v_bool for k in ("notification_enabled", "notify_medicine", "notify_water", "notify_walking",
                             "notify_respirometer", "notify_appointments", "notify_low_stock",
                             "water_reminder_enabled")},
}


def get_settings() -> dict:
    import os
    raw = {r["setting"]: r["value"] for r in get_store().read("Settings")}
    s = {}
    for key, default in DEFAULT_SETTINGS.items():
        value = raw.get(key, "")
        s[key] = value if str(value).strip() != "" else default
    name = s["father_name"].strip() or os.getenv("FATHER_NAME", "").strip() or "Dad"
    out = {"father_name": name}
    for key in ("water_target_ml", "respirometer_frequency", "respirometer_sessions", "respirometer_snooze_minutes",
                "medicine_snooze_minutes", "water_reminder_interval_minutes"):
        out[key] = int(_num(s[key]))
    for key in ("walking_target_minutes", "walking_target_distance"):
        out[key] = _num(s[key])
    for key in ("respirometer_start_time", "respirometer_end_time", "water_reminder_start_time",
                "water_reminder_end_time", "walking_reminder_time"):
        out[key] = tu.norm_time(s[key]) or tu.norm_time(DEFAULT_SETTINGS[key])
    out["appointment_reminder_days"] = s["appointment_reminder_days"]
    for key in ("notification_enabled", "notify_medicine", "notify_water", "notify_walking",
                "notify_respirometer", "notify_appointments", "notify_low_stock", "water_reminder_enabled"):
        out[key] = _bool(s[key])
    return out


def update_settings(updates: dict) -> dict:
    with _lock:
        clean = {}
        for key, value in updates.items():
            if key not in SETTING_VALIDATORS:
                raise AppError(f"'{key}' is not a setting you can change.", 400)
            try:
                clean[key] = SETTING_VALIDATORS[key](value)
            except ValueError as e:
                raise AppError(f"{key.replace('_', ' ').capitalize()}: {e}.", 400)
        store = get_store()
        existing = {r["setting"] for r in store.read("Settings")}
        for key, value in clean.items():
            if key in existing:
                store.update("Settings", "setting", key, {"value": value})
            else:
                store.append("Settings", {"setting": key, "value": value})
        return get_settings()


# ------------------------------------------------------------------ edit water / walking entries
def _find_log(sheet: str, log_id: str, label: str) -> dict:
    row = next((r for r in get_store().read(sheet) if r["log_id"] == log_id), None)
    if row is None:
        raise AppError(f"That {label} entry could not be found.", 404)
    return row


def update_water(log_id, amount_ml=None, date_str=None, time_str=None) -> dict:
    with _lock:
        _find_log("Water_Log", log_id, "water")
        updates = {}
        if amount_ml is not None:
            updates["amount_ml"] = str(int(amount_ml))
        if date_str:
            d = tu.parse_date(date_str)
            _not_future(d)
            updates["date"] = d.isoformat()
        if time_str:
            updates["time"] = time_str
        if updates:
            get_store().update("Water_Log", "log_id", log_id, updates)
        return get_water_today()


def update_walking(log_id, date_str=None, start_time=None, end_time=None, duration_minutes=None,
                   distance_km=None, notes=None) -> dict:
    with _lock:
        _find_log("Walking_Log", log_id, "walking")
        updates = {}
        if date_str:
            d = tu.parse_date(date_str)
            _not_future(d)
            updates["date"] = d.isoformat()
        if start_time is not None:
            updates["start_time"] = start_time
        if duration_minutes:                          # a number was typed
            updates["duration_minutes"] = _fmt_num(duration_minutes)
        elif start_time and end_time:                 # work it out from start and end time
            minutes = tu.minutes_of(tu.parse_time(end_time)) - tu.minutes_of(tu.parse_time(start_time))
            if minutes <= 0:
                raise AppError("The end time must be after the start time.", 400)
            updates["duration_minutes"] = _fmt_num(minutes)
        elif duration_minutes is not None:            # 0 was typed
            raise AppError("The walking time must be more than zero.", 400)
        if distance_km is not None:
            updates["distance_km"] = _fmt_num(distance_km)
        if notes is not None:
            updates["notes"] = notes
        if updates:
            get_store().update("Walking_Log", "log_id", log_id, updates)
        return get_walking_today()


# ------------------------------------------------------------------ delete water / walking entries
def delete_water(log_id) -> dict:
    with _lock:
        _find_log("Water_Log", log_id, "water")
        get_store().delete("Water_Log", "log_id", log_id)
        return get_water_today()


def delete_walking(log_id) -> dict:
    with _lock:
        _find_log("Walking_Log", log_id, "walking")
        get_store().delete("Walking_Log", "log_id", log_id)
        return get_walking_today()
