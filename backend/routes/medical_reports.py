"""Medical Reports API – upload, list, download and delete reports stored in Google Sheets."""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from services import google_sheets as sheets
from utils.auth import require_user
from utils.errors import AppError

router = APIRouter(
    prefix="/api/medical-reports",
    tags=["medical-reports"],
    dependencies=[Depends(require_user)],
)


# ── Schemas ────────────────────────────────────────────────────────────────────
class ReportIn(BaseModel):
    title:       str   = Field(min_length=1, max_length=200)
    category:    str   = Field(min_length=1, max_length=100)
    date:        str   = Field(min_length=1, max_length=10)
    description: str   = Field(default="", max_length=500)
    filename:    str   = Field(min_length=1, max_length=260)
    mime_type:   str   = Field(default="application/octet-stream", max_length=100)
    size_bytes:  int   = Field(default=0, ge=0, le=10 * 1024 * 1024)   # hard cap 10 MB
    content_b64: str   = Field(min_length=1)                            # base64-encoded file bytes


# ── Helpers ────────────────────────────────────────────────────────────────────
def _all_reports() -> list:
    from services.store import get_store
    rows = get_store().read("Medical_Reports")
    return [
        {
            "report_id":   r["report_id"],
            "title":       r["title"],
            "category":    r["category"],
            "date":        r["date"],
            "description": r.get("description", ""),
            "filename":    r.get("filename", ""),
            "mime_type":   r.get("mime_type", ""),
            "size_bytes":  int(r.get("size_bytes", 0) or 0),
            "uploaded_at": r.get("uploaded_at", ""),
        }
        for r in rows
        if r.get("report_id")
    ]


def _get_report(report_id: str) -> dict:
    from services.store import get_store
    rows = get_store().read("Medical_Reports")
    row  = next((r for r in rows if r.get("report_id") == report_id), None)
    if not row:
        raise AppError("Report not found.", 404)
    return row


# ── Endpoints ──────────────────────────────────────────────────────────────────
@router.get("")
def list_reports():
    return {"reports": _all_reports()}


@router.post("")
def upload_report(body: ReportIn):
    from services.store import get_store
    report_id  = str(uuid.uuid4())
    uploaded_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    get_store().append("Medical_Reports", {
        "report_id":   report_id,
        "title":       body.title,
        "category":    body.category,
        "date":        body.date,
        "description": body.description,
        "filename":    body.filename,
        "mime_type":   body.mime_type,
        "size_bytes":  str(body.size_bytes),
        "content_b64": body.content_b64,
        "uploaded_at": uploaded_at,
    })
    return {"report_id": report_id, "message": "Report uploaded successfully."}


@router.get("/{report_id}/download")
def download_report(report_id: str):
    row = _get_report(report_id)
    return {
        "report_id":   row["report_id"],
        "filename":    row.get("filename", "report"),
        "mime_type":   row.get("mime_type", "application/octet-stream"),
        "content_b64": row.get("content_b64", ""),
    }


@router.delete("/{report_id}")
def delete_report(report_id: str):
    from services.store import get_store
    deleted = get_store().delete("Medical_Reports", "report_id", report_id)
    if not deleted:
        raise AppError("Report not found.", 404)
    return {"message": "Report deleted."}
