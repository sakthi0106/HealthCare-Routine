from fastapi import APIRouter, Depends

from models.schemas import DoseAction, MedicineIn, MedicineUpdate
from services import google_sheets as sheets
from utils.auth import require_admin, require_user

router = APIRouter(prefix="/api/medicines", tags=["medicines"], dependencies=[Depends(require_user)])


@router.get("")
def list_medicines():
    return {"medicines": sheets.get_medicines()}


@router.get("/today")
def today_schedule():
    items = sheets.get_today_medicine_schedule()
    return {"items": items, **sheets.summarize_doses(items)}


@router.post("", dependencies=[Depends(require_admin)])
def create_medicine(body: MedicineIn):
    return sheets.add_medicine(body.model_dump())


@router.put("/{medicine_id}", dependencies=[Depends(require_admin)])
def edit_medicine(medicine_id: str, body: MedicineUpdate):
    return sheets.update_medicine(medicine_id, body.model_dump(exclude_unset=True))


@router.delete("/{medicine_id}", dependencies=[Depends(require_admin)])
def remove_medicine(medicine_id: str):
    sheets.delete_medicine(medicine_id)
    return {"deleted": True}


@router.post("/{medicine_id}/taken")
def taken(medicine_id: str, body: DoseAction = DoseAction()):
    return sheets.record_medicine_taken(medicine_id, body.log_id, body.scheduled_time)


@router.post("/{medicine_id}/skip")
def skip(medicine_id: str, body: DoseAction = DoseAction()):
    return sheets.record_medicine_skipped(medicine_id, body.log_id, body.scheduled_time)


@router.post("/{medicine_id}/snooze")
def snooze(medicine_id: str, body: DoseAction = DoseAction()):
    return sheets.record_medicine_snoozed(medicine_id, body.log_id, body.scheduled_time, body.snooze_minutes)
