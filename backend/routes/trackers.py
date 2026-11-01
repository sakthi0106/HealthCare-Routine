"""Water, walking and respirometer endpoints."""
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from models.schemas import WalkingIn, WalkingUpdate, WaterIn, WaterUpdate
from services import google_sheets as sheets
from utils.auth import require_user

router = APIRouter(prefix="/api", tags=["trackers"], dependencies=[Depends(require_user)])


class SnoozeIn(BaseModel):
    snooze_minutes: Optional[int] = Field(default=None, ge=1, le=240)


@router.get("/water/today")
def water_today():
    return sheets.get_water_today()


@router.post("/water")
def water_add(body: WaterIn):
    return sheets.add_water(body.amount_ml, body.date, body.time)
    
@router.put("/water/{log_id}")
def water_edit(log_id: str, body: WaterUpdate):
    return sheets.update_water(log_id, body.amount_ml, body.date, body.time)


@router.put("/walking/{log_id}")
def walking_edit(log_id: str, body: WalkingUpdate):
    return sheets.update_walking(log_id, body.date, body.start_time, body.end_time, body.duration_minutes,
                                 body.distance_km, body.notes)

@router.delete("/water/{log_id}")
def water_delete(log_id: str):
    return sheets.delete_water(log_id)


@router.delete("/walking/{log_id}")
def walking_delete(log_id: str):
    return sheets.delete_walking(log_id)


@router.get("/walking/today")
def walking_today():
    return sheets.get_walking_today()


@router.post("/walking")
def walking_add(body: WalkingIn):
    return sheets.add_walking(body.date, body.start_time, body.end_time, body.duration_minutes,
                              body.distance_km, body.notes)


@router.get("/respirometer/today")
def respirometer_today():
    items = sheets.get_respirometer_schedule()
    s = sheets.get_settings()
    return {"items": items, **sheets.summarize_sessions(items),
            "settings": {"start": s["respirometer_start_time"], "end": s["respirometer_end_time"],
                         "frequency_minutes": s["respirometer_frequency"]}}


@router.post("/respirometer/{log_id}/complete")
def respirometer_complete(log_id: str):
    return sheets.record_respirometer_completion(log_id)


@router.post("/respirometer/{log_id}/skip")
def respirometer_skip(log_id: str):
    return sheets.record_respirometer_skipped(log_id)


@router.post("/respirometer/{log_id}/snooze")
def respirometer_snooze(log_id: str, body: SnoozeIn = SnoozeIn()):
    return sheets.record_respirometer_snoozed(log_id, body.snooze_minutes)


class BloodSugarIn(BaseModel):
    glucose_level: int = Field(gt=20, le=800)
    meal_context: Optional[str] = Field(default="Fasting", max_length=50)
    date: Optional[str] = None
    time: Optional[str] = None
    notes: Optional[str] = Field(default="", max_length=300)


@router.get("/blood-sugar/today")
def blood_sugar_today():
    return sheets.get_blood_sugar_today()


@router.post("/blood-sugar")
def blood_sugar_add(body: BloodSugarIn):
    return sheets.add_blood_sugar(body.glucose_level, body.meal_context, body.date, body.time, body.notes)


@router.delete("/blood-sugar/{log_id}")
def blood_sugar_delete(log_id: str):
    return sheets.delete_blood_sugar(log_id)
