"""Request validation (Pydantic). Anything invalid is rejected before it touches the Sheet."""
from typing import Optional

from pydantic import BaseModel, Field, ValidationInfo, field_validator, model_validator

from models.schema import APPOINTMENT_STATUSES
from utils import timeutil as tu


def _clean(v):
    return v.strip() if isinstance(v, str) else v


def _time_or_blank(v):
    v = _clean(v)
    if v in (None, ""):
        return ""
    if tu.parse_time(v) is None:
        raise ValueError("must be a valid time like 08:00")
    return tu.norm_time(v)

def _medicine_time_or_blank(v, slot):
    v = _clean(v)
    if v in (None, ""):
        return ""
    if tu.parse_time(v) is None:
        raise ValueError("must be a valid time like 08:00")
    return tu.normalize_medicine_time(v, slot)


def _date_or_blank(v):
    v = _clean(v)
    if v in (None, ""):
        return ""
    d = tu.parse_date(v)
    if d is None:
        raise ValueError("must be a valid date like 2026-10-11")
    return d.isoformat()


class LoginIn(BaseModel):
    pin: str = Field(min_length=1, max_length=40)


# ---------- medicines ----------
class MedicineIn(BaseModel):
    medicine_name: str = Field(min_length=1, max_length=100)
    generic_name: str = Field(default="", max_length=100)
    dosage: str = Field(default="", max_length=200)
    frequency: str = Field(default="", max_length=100)
    morning_time: str = ""
    afternoon_time: str = ""
    evening_time: str = ""
    night_time: str = ""
    daily_quantity: float = Field(default=0, ge=0, le=1000)
    current_stock: float = Field(default=0, ge=0, le=100000)
    reorder_level: float = Field(default=0, ge=0, le=100000)
    start_date: str = ""
    end_date: str = ""
    active: bool = True
    notes: str = Field(default="", max_length=500)

    @field_validator("medicine_name", "generic_name", "dosage", "frequency", "notes", mode="before")
    @classmethod
    def _strip(cls, v):
        return _clean(v)

    @field_validator("morning_time", "afternoon_time", "evening_time", "night_time", mode="before")
    @classmethod
    def _times(cls, v):
        return _time_or_blank(v)

    @field_validator("start_date", "end_date", mode="before")
    @classmethod
    def _dates(cls, v):
        return _date_or_blank(v)

    @model_validator(mode="after")
    def _order(self):
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValueError("end date cannot be before the start date")
        return self


class MedicineUpdate(BaseModel):
    medicine_name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    generic_name: Optional[str] = Field(default=None, max_length=100)
    dosage: Optional[str] = Field(default=None, max_length=200)
    frequency: Optional[str] = Field(default=None, max_length=100)
    morning_time: Optional[str] = None
    afternoon_time: Optional[str] = None
    evening_time: Optional[str] = None
    night_time: Optional[str] = None
    daily_quantity: Optional[float] = Field(default=None, ge=0, le=1000)
    current_stock: Optional[float] = Field(default=None, ge=0, le=100000)
    reorder_level: Optional[float] = Field(default=None, ge=0, le=100000)
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    active: Optional[bool] = None
    notes: Optional[str] = Field(default=None, max_length=500)

    @field_validator("morning_time", "afternoon_time", "evening_time", "night_time", mode="before")
    @classmethod
    def _times(cls, v):
        return None if v is None else _time_or_blank(v)

    @field_validator("start_date", "end_date", mode="before")
    @classmethod
    def _dates(cls, v):
        return None if v is None else _date_or_blank(v)


class DoseAction(BaseModel):
    log_id: Optional[str] = Field(default=None, max_length=40)
    scheduled_time: Optional[str] = None
    snooze_minutes: Optional[int] = Field(default=None, ge=1, le=240)

    @field_validator("scheduled_time", mode="before")
    @classmethod
    def _t(cls, v):
        return None if v in (None, "") else _time_or_blank(v)


# ---------- water / walking ----------
class WaterIn(BaseModel):
    amount_ml: int = Field(gt=0, le=5000)
    date: Optional[str] = None
    time: Optional[str] = None

    @field_validator("date", mode="before")
    @classmethod
    def _d(cls, v):
        return None if v in (None, "") else _date_or_blank(v)

    @field_validator("time", mode="before")
    @classmethod
    def _t(cls, v):
        return None if v in (None, "") else _time_or_blank(v)


class WalkingIn(BaseModel):
    date: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    duration_minutes: Optional[float] = Field(default=None, ge=0, le=1440)
    distance_km: float = Field(default=0, ge=0, le=500)
    notes: str = Field(default="", max_length=300)

    @field_validator("date", mode="before")
    @classmethod
    def _d(cls, v):
        return None if v in (None, "") else _date_or_blank(v)

    @field_validator("start_time", "end_time", mode="before")
    @classmethod
    def _t(cls, v):
        return None if v in (None, "") else _time_or_blank(v)


# ---------- appointments ----------
class AppointmentIn(BaseModel):
    date: str
    time: str
    doctor: str = Field(default="", max_length=100)
    hospital: str = Field(default="", max_length=150)
    department: str = Field(default="", max_length=100)
    purpose: str = Field(default="", max_length=200)
    reminder_days: str = Field(default="7,1", max_length=40)
    status: str = "Scheduled"
    notes: str = Field(default="", max_length=500)

    @field_validator("date", mode="before")
    @classmethod
    def _d(cls, v):
        v = _date_or_blank(v)
        if not v:
            raise ValueError("a date is required")
        return v

    @field_validator("time", mode="before")
    @classmethod
    def _t(cls, v):
        v = _time_or_blank(v)
        if not v:
            raise ValueError("a time is required")
        return v

    @field_validator("reminder_days")
    @classmethod
    def _r(cls, v):
        tu.parse_reminder_tokens(v)
        return v.strip()

    @field_validator("status")
    @classmethod
    def _s(cls, v):
        if v not in APPOINTMENT_STATUSES:
            raise ValueError("status must be one of " + ", ".join(APPOINTMENT_STATUSES))
        return v


class AppointmentUpdate(BaseModel):
    date: Optional[str] = None
    time: Optional[str] = None
    doctor: Optional[str] = Field(default=None, max_length=100)
    hospital: Optional[str] = Field(default=None, max_length=150)
    department: Optional[str] = Field(default=None, max_length=100)
    purpose: Optional[str] = Field(default=None, max_length=200)
    reminder_days: Optional[str] = Field(default=None, max_length=40)
    status: Optional[str] = None
    notes: Optional[str] = Field(default=None, max_length=500)

    @field_validator("date", mode="before")
    @classmethod
    def _d(cls, v):
        if v is None:
            return None
        v = _date_or_blank(v)
        if not v:
            raise ValueError("a date is required")
        return v

    @field_validator("time", mode="before")
    @classmethod
    def _t(cls, v):
        if v is None:
            return None
        v = _time_or_blank(v)
        if not v:
            raise ValueError("a time is required")
        return v

    @field_validator("reminder_days")
    @classmethod
    def _r(cls, v):
        if v is not None:
            tu.parse_reminder_tokens(v)
            return v.strip()
        return v

    @field_validator("status")
    @classmethod
    def _s(cls, v):
        if v is not None and v not in APPOINTMENT_STATUSES:
            raise ValueError("status must be one of " + ", ".join(APPOINTMENT_STATUSES))
        return v


# ---------- inventory / settings / AI ----------
class PurchaseIn(BaseModel):
    medicine_id: str = Field(min_length=1, max_length=40)
    quantity: float = Field(gt=0, le=100000)
    date: Optional[str] = None
    notes: str = Field(default="", max_length=300)

    @field_validator("date", mode="before")
    @classmethod
    def _d(cls, v):
        return None if v in (None, "") else _date_or_blank(v)


class SettingsUpdate(BaseModel):
    values: dict


class ChatTurn(BaseModel):
    role: str
    content: str = Field(max_length=1000)


class ChatIn(BaseModel):
    message: str = Field(min_length=1, max_length=500)
    history: list[ChatTurn] = Field(default_factory=list, max_length=12)
