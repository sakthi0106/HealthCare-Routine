"""Builds the dashboard and the history/report data from the other services."""
from datetime import timedelta

from services import google_sheets as sheets
from services import inventory
from utils import timeutil as tu
from utils.errors import AppError

MAX_DAYS = 92


def _greeting(now_dt) -> str:
    h = now_dt.hour
    return "Good Morning" if h < 12 else "Good Afternoon" if h < 17 else "Good Evening"


def dashboard(user_role: str = 'father') -> dict:
    now_dt = tu.now()
    settings = sheets.get_settings()
    doses = sheets.get_today_medicine_schedule()
    sessions = sheets.get_respirometer_schedule()
    appts = sheets.get_appointments(upcoming_only=True)
    nxt_dose = next((d for d in doses if d["status"] in ("Pending", "Snoozed")), None)
    return {
        "greeting": _greeting(now_dt),
        "name": settings.get("admin_name", "Dhanushkumar A") if user_role == "admin" else settings.get("father_name", "Ayyamperumal E"),
        "date": now_dt.date().isoformat(),
        "medicines": {"items": doses, **sheets.summarize_doses(doses), "next": nxt_dose},
        "water": sheets.get_water_today(),
        "blood_sugar": sheets.get_blood_sugar_today(),
        "walking": sheets.get_walking_today(),
        "respirometer": {"items": sessions, **sheets.summarize_sessions(sessions)},
        "next_appointment": appts[0] if appts else None,
        "low_stock": inventory.get_low_stock_medicines(),
    }


def resolve_range(name, start=None, end=None):
    t = tu.today()
    if name == "today":
        s, e = t, t
    elif name == "week":
        s, e = t - timedelta(days=t.weekday()), t
    elif name == "month":
        s, e = t.replace(day=1), t
    elif name == "last7":
        s, e = t - timedelta(days=6), t
    elif name == "last30":
        s, e = t - timedelta(days=29), t
    elif name == "custom":
        s, e = tu.parse_date(start), tu.parse_date(end)
        if not s or not e:
            raise AppError("Please choose a valid start and end date.", 400)
        if s > e:
            raise AppError("The start date must be before the end date.", 400)
        e = min(e, t)
        if s > e:
            raise AppError("Those dates are in the future.", 400)
    else:
        raise AppError("Unknown date range.", 400)
    if (e - s).days + 1 > MAX_DAYS:
        raise AppError(f"Please choose a range of {MAX_DAYS} days or fewer.", 400)
    return s, e


def _days(s, e):
    return [s + timedelta(days=i) for i in range((e - s).days + 1)]


def _medicine_history(s, e) -> dict:
    """Saved log rows, plus 'not recorded' rows for expected doses that have no log (e.g. app not opened)."""
    store_rows = sheets.get_store().read("Medicine_Log")
    meds = sheets.get_medicines()
    by_id = {m["medicine_id"]: m for m in meds}
    logs, seen = [], set()
    for r in store_rows:
        d = tu.parse_date(r["date"])
        if d and s <= d <= e:
            t = tu.norm_time(r["scheduled_time"])
            seen.add((d, r["medicine_id"], t))
            logs.append({"log_id": r["log_id"], "date": d.isoformat(), "medicine_id": r["medicine_id"],
                         "medicine_name": r["medicine_name"], "scheduled_time": t, "status": r["status"] or "Pending",
                         "taken_time": tu.norm_time(r["taken_time"]), "recorded": True})
    for d in _days(s, e):
        for m in meds:
            if sheets._scheduled_on(m, d):
                for _slot, t in sheets._slots_of(m):
                    if (d, m["medicine_id"], t) not in seen:
                        logs.append({"log_id": "", "date": d.isoformat(), "medicine_id": m["medicine_id"],
                                     "medicine_name": by_id[m["medicine_id"]]["medicine_name"], "scheduled_time": t,
                                     "status": "Pending", "taken_time": "", "recorded": False})
    logs.sort(key=lambda x: (x["date"], x["scheduled_time"]), reverse=True)
    count = lambda st: sum(1 for x in logs if x["status"] == st)  # noqa: E731
    per_day = {}
    for x in logs:
        p = per_day.setdefault(x["date"], {"date": x["date"], "scheduled": 0, "taken": 0, "skipped": 0})
        p["scheduled"] += 1
        p["taken"] += x["status"] == "Taken"
        p["skipped"] += x["status"] == "Skipped"
    days = [per_day.get(d.isoformat(), {"date": d.isoformat(), "scheduled": 0, "taken": 0, "skipped": 0}) for d in _days(s, e)]
    return {"logs": logs, "days": days,
            "summary": {"scheduled": len(logs), "taken": count("Taken"), "skipped": count("Skipped"),
                        "snoozed": count("Snoozed"), "pending": count("Pending")}}


def _water_history(s, e) -> dict:
    totals = {d.isoformat(): 0 for d in _days(s, e)}
    for w in sheets.get_water_logs(s, e):
        totals[w["date"]] = totals.get(w["date"], 0) + w["amount_ml"]
    days = [{"date": k, "total_ml": v} for k, v in sorted(totals.items())]
    total = sum(d["total_ml"] for d in days)
    return {"days": days, "total_ml": total, "average_ml": round(total / len(days)) if days else 0}


def _walking_history(s, e) -> dict:
    per = {d.isoformat(): {"date": d.isoformat(), "minutes": 0, "km": 0} for d in _days(s, e)}
    for w in sheets.get_walking_logs(s, e):
        per[w["date"]]["minutes"] += w["duration_minutes"]
        per[w["date"]]["km"] = round(per[w["date"]]["km"] + w["distance_km"], 2)
    days = sorted(per.values(), key=lambda x: x["date"])
    n = len(days) or 1
    tm, tk = round(sum(x["minutes"] for x in days), 1), round(sum(x["km"] for x in days), 2)
    return {"days": days, "total_minutes": tm, "total_km": tk,
            "average_minutes": round(tm / n, 1), "average_km": round(tk / n, 2)}


def _resp_history(s, e) -> dict:
    rows = sheets.get_store().read("Respirometer_Log")
    times = sheets.respirometer_times()
    logs, seen = [], set()
    for r in rows:
        d = tu.parse_date(r["date"])
        if d and s <= d <= e:
            t = tu.norm_time(r["scheduled_time"])
            seen.add((d, t))
            logs.append({"date": d.isoformat(), "scheduled_time": t, "completed_time": tu.norm_time(r["completed_time"]),
                         "status": r["status"] or "Pending"})
    for d in _days(s, e):
        for t in times:
            if (d, t) not in seen:
                logs.append({"date": d.isoformat(), "scheduled_time": t, "completed_time": "", "status": "Pending"})
    logs.sort(key=lambda x: (x["date"], x["scheduled_time"]), reverse=True)
    per = {d.isoformat(): {"date": d.isoformat(), "scheduled": 0, "completed": 0} for d in _days(s, e)}
    for x in logs:
        p = per.setdefault(x["date"], {"date": x["date"], "scheduled": 0, "completed": 0})
        p["scheduled"] += 1
        p["completed"] += x["status"] == "Completed"
    count = lambda st: sum(1 for x in logs if x["status"] == st)  # noqa: E731
    return {"logs": logs, "days": sorted(per.values(), key=lambda x: x["date"]),
            "summary": {"scheduled": len(logs), "completed": count("Completed"), "skipped": count("Skipped"),
                        "pending": count("Pending") + count("Snoozed")}}



def _sugar_history(s, e) -> dict:
    rows = sheets.get_blood_sugar_logs(s, e)
    per_day = {d.isoformat(): [] for d in _days(s, e)}
    for r in rows:
        per_day.setdefault(r["date"], []).append(r)
    days = []
    all_readings = [r["glucose_level"] for r in rows if r.get("glucose_level")]
    avg_glucose = round(sum(all_readings) / len(all_readings)) if all_readings else 0
    for d in _days(s, e):
        d_str = d.isoformat()
        items = per_day.get(d_str, [])
        vals = [i["glucose_level"] for i in items if i.get("glucose_level")]
        day_avg = round(sum(vals) / len(vals)) if vals else None
        days.append({
            "date": d_str,
            "average": day_avg,
            "readings": items,
            "count": len(items),
        })
    return {"days": days, "logs": rows, "average_glucose": avg_glucose, "total_tests": len(rows)}


def history(range_name="today", start=None, end=None, parts=None) -> dict:
    s, e = resolve_range(range_name, start, end)
    want = set(parts or ["medicine", "water", "walking", "respirometer"])
    out = {"start": s.isoformat(), "end": e.isoformat(), "days_in_range": (e - s).days + 1}
    if "medicine" in want:
        out["medicine"] = _medicine_history(s, e)
    if "water" in want:
        out["water"] = _water_history(s, e)
    if "walking" in want:
        out["walking"] = _walking_history(s, e)
    if "respirometer" in want:
        out["respirometer"] = _resp_history(s, e)
    return out
