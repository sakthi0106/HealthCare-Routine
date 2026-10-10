import os
from datetime import datetime

import pytest

os.environ.update(FATHER_PIN="1111", ADMIN_PIN="9999", JWT_SECRET="x" * 32,
                  APP_TIMEZONE="Asia/Kolkata", OPENAI_API_KEY="")

from fastapi.testclient import TestClient  # noqa: E402

from app import app  # noqa: E402
from services import store as store_mod  # noqa: E402
from tests.memory_store import MemoryStore  # noqa: E402
from utils import auth, timeutil as tu  # noqa: E402

client = TestClient(app)


def freeze(hh, mm=0):
    tu.set_now_override(datetime(2026, 10, 5, hh, mm, tzinfo=tu.tz()))


@pytest.fixture(autouse=True)
def fresh():
    store_mod.set_store(MemoryStore())
    auth._fails.clear()
    freeze(9, 0)
    yield
    tu.set_now_override(None)


def login(pin):
    r = client.post("/api/auth/login", json={"pin": pin})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture
def admin():
    return login("9999")


@pytest.fixture
def father():
    return login("1111")


def add_med(admin, **over):
    body = {"medicine_name": "Medicine A", "dosage": "1 tablet", "morning_time": "08:00", "night_time": "21:00",
            "daily_quantity": 2, "current_stock": 4, "reorder_level": 3}
    body.update(over)
    r = client.post("/api/medicines", json=body, headers=admin)
    assert r.status_code == 200, r.text
    return r.json()


# ---------------- auth ----------------
def test_login_and_roles(admin, father):
    assert client.post("/api/auth/login", json={"pin": "bad"}).status_code == 401
    assert client.get("/api/dashboard").status_code == 401
    assert client.post("/api/medicines", json={"medicine_name": "X"}, headers=father).status_code == 403
    assert client.get("/api/dashboard", headers=father).status_code == 200


def test_login_rate_limit():
    for _ in range(5):
        client.post("/api/auth/login", json={"pin": "bad"})
    assert client.post("/api/auth/login", json={"pin": "1111"}).status_code == 429


# ---------------- medicines ----------------
def test_medicine_flow_and_stock(admin, father):
    med = add_med(admin)
    assert med["medicine_id"] == "MED-001" and med["dose_quantity"] == 1
    sched = client.get("/api/medicines/today", headers=father).json()
    assert sched["total"] == 2 and sched["items"][0]["state"] == "due"      # 08:00 passed at 09:00
    assert sched["items"][1]["state"] == "upcoming"
    log_id = sched["items"][0]["log_id"]

    r = client.post(f"/api/medicines/{med['medicine_id']}/taken", json={"log_id": log_id}, headers=father).json()
    assert r["current_stock"] == 3 and r["dose"]["status"] == "Taken"
    again = client.post(f"/api/medicines/{med['medicine_id']}/taken", json={"log_id": log_id}, headers=father).json()
    assert again["already_recorded"] and again["current_stock"] == 3          # no double deduction

    inv = client.get("/api/inventory", headers=father).json()["items"][0]
    assert inv["state"] == "low" and inv["estimated_days_remaining"] == 1.5
    assert "running low" in inv["alert"]


def test_stock_never_negative_and_out_alert(admin, father):
    med = add_med(admin, current_stock=1, reorder_level=1)
    items = client.get("/api/medicines/today", headers=father).json()["items"]
    client.post(f"/api/medicines/{med['medicine_id']}/taken", json={"log_id": items[0]["log_id"]}, headers=father)
    freeze(21, 30)
    items = client.get("/api/medicines/today", headers=father).json()["items"]
    client.post(f"/api/medicines/{med['medicine_id']}/taken", json={"log_id": items[1]["log_id"]}, headers=father)
    inv = client.get("/api/inventory", headers=father).json()["items"][0]
    assert inv["current_stock"] == 0 and inv["state"] == "out"
    assert "out of stock" in inv["alert"]


def test_skip_snooze_and_cannot_skip_taken(admin, father):
    med = add_med(admin)
    mid = med["medicine_id"]
    items = client.get("/api/medicines/today", headers=father).json()["items"]
    r = client.post(f"/api/medicines/{mid}/snooze", json={"log_id": items[0]["log_id"]}, headers=father).json()
    assert r["dose"]["state"] == "snoozed" and r["dose"]["snooze_until"] == "09:15"
    client.post(f"/api/medicines/{mid}/taken", json={"log_id": items[0]["log_id"]}, headers=father)
    assert client.post(f"/api/medicines/{mid}/skip", json={"log_id": items[0]["log_id"]}, headers=father).status_code == 400
    assert client.post("/api/medicines/MED-999/taken", json={}, headers=father).status_code == 404


def test_medicine_validation(admin):
    assert client.post("/api/medicines", json={"medicine_name": "A", "current_stock": -1}, headers=admin).status_code == 422
    assert client.post("/api/medicines", json={"medicine_name": "A", "morning_time": "25:00"}, headers=admin).status_code == 422
    r = client.post("/api/medicines", json={"medicine_name": "A", "start_date": "2026-10-05", "end_date": "2026-10-01"}, headers=admin)
    assert r.status_code == 422 and "detail" in r.json()


def test_end_date_hides_medicine(admin, father):
    add_med(admin, end_date="2026-10-01")
    assert client.get("/api/medicines/today", headers=father).json()["total"] == 0


def test_purchase_restock(admin):
    med = add_med(admin, current_stock=1)
    r = client.post("/api/inventory/purchase", json={"medicine_id": med["medicine_id"], "quantity": 30}, headers=admin)
    assert r.json()["current_stock"] == 31 and r.json()["state"] == "ok"
    assert client.post("/api/inventory/purchase", json={"medicine_id": med["medicine_id"], "quantity": 0}, headers=admin).status_code == 422
    assert client.post("/api/inventory/purchase", json={"medicine_id": "NOPE", "quantity": 5}, headers=admin).status_code == 404
    assert len(client.get("/api/inventory/purchases", headers=admin).json()["purchases"]) == 1


# ---------------- water / walking ----------------
def test_water(father):
    assert client.post("/api/water", json={"amount_ml": 0}, headers=father).status_code == 422
    assert client.post("/api/water", json={"amount_ml": -5}, headers=father).status_code == 422
    client.post("/api/water", json={"amount_ml": 250}, headers=father)
    r = client.post("/api/water", json={"amount_ml": 500}, headers=father).json()
    assert r["total_ml"] == 750 and r["target_ml"] == 2500 and r["percent"] == 30 and len(r["entries"]) == 2


def test_walking(father):
    assert client.post("/api/walking", json={"duration_minutes": -1}, headers=father).status_code == 422
    assert client.post("/api/walking", json={"distance_km": -2, "duration_minutes": 5}, headers=father).status_code == 422
    assert client.post("/api/walking", json={"distance_km": 1}, headers=father).status_code == 400
    assert client.post("/api/walking", json={"start_time": "10:00", "end_time": "09:00"}, headers=father).status_code == 400
    r = client.post("/api/walking", json={"start_time": "07:00", "end_time": "07:32", "distance_km": 2.4}, headers=father).json()
    assert r["total_minutes"] == 32 and r["total_km"] == 2.4


# ---------------- respirometer ----------------
def test_respirometer_schedule_follows_settings(admin, father):
    items = client.get("/api/respirometer/today", headers=father).json()["items"]
    assert [i["scheduled_time"] for i in items] == ["08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00"]
    client.put("/api/settings", json={"values": {"respirometer_frequency": 180, "respirometer_start_time": "09:00",
                                                  "respirometer_end_time": "18:00"}}, headers=admin)
    data = client.get("/api/respirometer/today", headers=father).json()
    pending = [i["scheduled_time"] for i in data["items"] if i["status"] == "Pending"]
    assert pending == ["09:00", "12:00", "15:00", "18:00"]
    first = data["items"][0]["log_id"]
    r = client.post(f"/api/respirometer/{first}/complete", headers=father).json()
    assert r["status"] == "Completed"
    assert client.post("/api/respirometer/NOPE/complete", headers=father).status_code == 404


# ---------------- appointments ----------------
def test_appointments(admin, father):
    body = {"date": "2026-10-11", "time": "10:30", "doctor": "Dr. Rao", "hospital": "City", "purpose": "Cardiology Checkup"}
    a = client.post("/api/appointments", json=body, headers=admin).json()
    assert client.post("/api/appointments", json={**body, "date": "31-31-2026"}, headers=admin).status_code == 422
    assert client.post("/api/appointments", json=body, headers=father).status_code == 403
    client.put(f"/api/appointments/{a['appointment_id']}", json={"hospital": "New"}, headers=admin)
    ups = client.get("/api/appointments?upcoming=true", headers=father).json()["appointments"]
    assert ups[0]["hospital"] == "New"
    d = client.get("/api/dashboard", headers=father).json()
    assert d["next_appointment"]["purpose"] == "Cardiology Checkup"


# ---------------- dashboard / history / settings ----------------
def test_dashboard_summary(admin, father):
    add_med(admin, current_stock=2, reorder_level=3)
    client.post("/api/water", json={"amount_ml": 500}, headers=father)
    d = client.get("/api/dashboard", headers=father).json()
    assert d["medicines"]["total"] == 2 and d["water"]["total_ml"] == 500
    assert d["greeting"] == "Good Morning" and len(d["low_stock"]) == 1
    assert d["respirometer"]["total"] == 7


def test_history_counts_unrecorded_days(admin, father):
    add_med(admin, start_date="2026-10-01")
    items = client.get("/api/medicines/today", headers=father).json()["items"]
    client.post(f"/api/medicines/MED-001/taken", json={"log_id": items[0]["log_id"]}, headers=father)
    h = client.get("/api/history?range=week&parts=medicine,water", headers=father).json()
    # Mon 5 Oct is the only day so far this week
    assert h["medicine"]["summary"]["scheduled"] == 2 and h["medicine"]["summary"]["taken"] == 1
    h = client.get("/api/history?range=custom&start=2026-10-01&end=2026-10-05&parts=medicine", headers=father).json()
    assert h["medicine"]["summary"]["scheduled"] == 10    # 5 days x 2 doses, unrecorded days counted
    assert client.get("/api/history?range=custom&start=2026-10-05&end=2026-10-01", headers=father).status_code == 400


def test_settings_validation(admin, father):
    assert client.put("/api/settings", json={"values": {"water_target_ml": "abc"}}, headers=admin).status_code == 400
    assert client.put("/api/settings", json={"values": {"hacker": "1"}}, headers=admin).status_code == 400
    assert client.put("/api/settings", json={"values": {"water_target_ml": 3000}}, headers=father).status_code == 403
    s = client.put("/api/settings", json={"values": {"water_target_ml": 3000, "father_name": "Ravi"}}, headers=admin).json()
    assert s["water_target_ml"] == 3000 and s["father_name"] == "Ravi"
    assert client.get("/api/dashboard", headers=father).json()["name"] == "Ravi"


# ---------------- notifications ----------------
def test_notifications(admin, father):
    add_med(admin, current_stock=2)
    freeze(9, 5)
    types = {n["type"] for n in client.get("/api/notifications/due", headers=father).json()["notifications"]}
    assert {"MEDICINE_REMINDER", "RESPIROMETER_REMINDER", "WATER_REMINDER", "LOW_STOCK_ALERT"} <= types
    client.put("/api/settings", json={"values": {"notification_enabled": False}}, headers=admin)
    assert client.get("/api/notifications/due", headers=father).json()["notifications"] == []


def test_appointment_reminder_picks_latest_only(admin, father):
    client.post("/api/appointments", json={"date": "2026-10-06", "time": "10:30", "purpose": "Checkup",
                                            "reminder_days": "7,1,2h"}, headers=admin)
    n = [x for x in client.get("/api/notifications/due", headers=father).json()["notifications"]
         if x["type"] == "APPOINTMENT_REMINDER"]
    assert len(n) == 1 and n[0]["id"].endswith("-1d")


# ---------------- AI safety ----------------
@pytest.mark.parametrize("q,needle", [
    ("Should I take two tablets?", "can't determine or change your prescribed dosage"),
    ("I have chest pain", "healthcare professional or emergency service"),
    ("I feel dizzy today", "healthcare professional or emergency service"),
    ("Do I have diabetes?", "can't diagnose"),
    ("Can you recommend a painkiller", "can't recommend"),
    ("What if I missed a dose?", "doctor or pharmacist"),
])
def test_ai_safety_filter(father, q, needle):
    r = client.post("/api/ai/chat", json={"message": q}, headers=father).json()
    assert r["source"] == "safety" and needle in r["reply"]


def test_ai_answers_from_data(admin, father):
    add_med(admin)
    r = client.post("/api/ai/chat", json={"message": "Did I take my morning tablets?"}, headers=father).json()
    assert "not recorded as taken yet" in r["reply"]
    items = client.get("/api/medicines/today", headers=father).json()["items"]
    freeze(9, 17)
    client.post("/api/medicines/MED-001/taken", json={"log_id": items[0]["log_id"]}, headers=father)
    r = client.post("/api/ai/chat", json={"message": "Did I take my morning tablets?"}, headers=father).json()
    assert "taken at 9:17 AM" in r["reply"]
    assert "0 of 0" not in client.post("/api/ai/chat", json={"message": "how much water"}, headers=father).json()["reply"]
    r = client.post("/api/ai/chat", json={"message": "Show my evening medicine"}, headers=father).json()
    assert "don't have any evening" in r["reply"]
    r = client.post("/api/ai/chat", json={"message": "Which medicines are running low?"}, headers=father).json()
    assert "Medicine A" in r["reply"]


# ---------------- errors ----------------
def test_store_failure_is_friendly(father, monkeypatch):
    from utils.errors import AppError

    class Broken(MemoryStore):
        def read(self, sheet):
            raise AppError("Unable to reach the data store. Please try again.", 503)

    store_mod.set_store(Broken())
    r = client.post("/api/water", json={"amount_ml": 250}, headers=father)
    assert r.status_code == 503 and "Unable to reach" in r.json()["detail"]
