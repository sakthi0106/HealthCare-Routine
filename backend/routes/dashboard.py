from typing import Optional

from fastapi import APIRouter, Depends, Query

from services import reminders, summary
from utils.auth import require_user

router = APIRouter(prefix="/api", tags=["dashboard"], dependencies=[Depends(require_user)])


@router.get("/dashboard")
def get_dashboard():
    return summary.dashboard()


@router.get("/history")
def get_history(range: str = "today", start: Optional[str] = None, end: Optional[str] = None,
                parts: Optional[str] = Query(default=None, description="comma list: medicine,water,walking,respirometer")):
    return summary.history(range, start, end, parts.split(",") if parts else None)


@router.get("/notifications/due")
def due_notifications():
    return {"notifications": reminders.get_due_notifications()}
