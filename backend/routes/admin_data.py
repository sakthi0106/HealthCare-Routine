"""Appointments, inventory, settings and AI chat."""
from fastapi import APIRouter, Depends

from models.schemas import AppointmentIn, AppointmentUpdate, ChatIn, PurchaseIn, SettingsUpdate
from services import ai_assistant, inventory
from services import google_sheets as sheets
from utils.auth import require_admin, require_user

router = APIRouter(prefix="/api", tags=["data"], dependencies=[Depends(require_user)])


@router.get("/appointments")
def appointments(upcoming: bool = False):
    return {"appointments": sheets.get_appointments(upcoming_only=upcoming)}


@router.post("/appointments", dependencies=[Depends(require_admin)])
def appointment_add(body: AppointmentIn):
    return sheets.add_appointment(body.model_dump())


@router.put("/appointments/{appointment_id}", dependencies=[Depends(require_admin)])
def appointment_edit(appointment_id: str, body: AppointmentUpdate):
    return sheets.update_appointment(appointment_id, body.model_dump(exclude_unset=True))


@router.delete("/appointments/{appointment_id}", dependencies=[Depends(require_admin)])
def appointment_delete(appointment_id: str):
    sheets.delete_appointment(appointment_id)
    return {"deleted": True}


@router.get("/inventory")
def inventory_list():
    return {"items": inventory.get_inventory()}


@router.get("/inventory/purchases")
def purchases():
    return {"purchases": sheets.get_purchases()}


@router.post("/inventory/purchase", dependencies=[Depends(require_admin)])
def purchase(body: PurchaseIn):
    return inventory.add_purchase(body.medicine_id, body.quantity, body.date, body.notes)


@router.get("/settings")
def settings_get():
    return sheets.get_settings()


@router.put("/settings", dependencies=[Depends(require_admin)])
def settings_update(body: SettingsUpdate):
    return sheets.update_settings(body.values)


@router.post("/ai/chat")
def ai_chat(body: ChatIn):
    return ai_assistant.chat(body.message, [t.model_dump() for t in body.history])
