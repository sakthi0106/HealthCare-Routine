"""Medicine stock maths: days remaining, run-out date, low / out-of-stock alerts."""
from datetime import timedelta

from services import google_sheets as sheets
from utils import timeutil as tu

ORDER = {"out": 0, "low": 1, "ok": 2}


def stock_state(stock: float, reorder_level: float) -> str:
    if stock <= 0:
        return "out"
    if reorder_level > 0 and stock <= reorder_level:
        return "low"
    return "ok"


def alert_text(item: dict) -> str:
    name, stock = item["medicine_name"], item["current_stock"]
    if item["state"] == "out":
        return f"{name} is out of stock."
    return f"{name} is running low. {stock} tablets remaining."


def get_inventory(include_inactive: bool = False) -> list:
    today = tu.today()
    items = []
    for m in sheets.get_medicines():
        if not m["active"] and not include_inactive:
            continue
        daily = m["daily_quantity"]
        per_day = daily / m["interval_days"]          # an alternate-day medicine uses half a day's amount per calendar day
        days = m["current_stock"] / per_day if per_day > 0 else None
        state = stock_state(m["current_stock"], m["reorder_level"])
        item = {
            "medicine_id": m["medicine_id"], "medicine_name": m["medicine_name"], "dosage": m["dosage"],
            "current_stock": m["current_stock"], "reorder_level": m["reorder_level"],
            "daily_quantity": daily, "interval_days": m["interval_days"], "active": m["active"], "state": state,
            "estimated_days_remaining": round(days, 1) if days is not None else None,
            "run_out_date": (today + timedelta(days=int(days))).isoformat() if days is not None else None,
        }
        item["alert"] = alert_text(item) if state != "ok" else ""
        items.append(item)
    return sorted(items, key=lambda i: (ORDER[i["state"]], i["medicine_name"].lower()))


def get_low_stock_medicines() -> list:
    return [i for i in get_inventory() if i["state"] != "ok"]


def add_purchase(medicine_id, quantity, date_str=None, notes="") -> dict:
    sheets.add_medicine_purchase(medicine_id, quantity, date_str, notes)
    return next(i for i in get_inventory(include_inactive=True) if i["medicine_id"] == medicine_id)
