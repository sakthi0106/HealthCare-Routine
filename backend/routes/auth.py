from fastapi import APIRouter, Depends, Request

from models.schemas import LoginIn
from services import google_sheets as sheets
from utils import auth
from utils.errors import AppError

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login")
def login(body: LoginIn, request: Request):
    ip = request.client.host if request.client else "unknown"
    auth.check_rate_limit(ip)
    role = auth.role_for_pin(body.pin)
    if role is None:
        auth.register_failure(ip)
        raise AppError("That PIN is not correct. Please try again.", 401)
    auth.clear_failures(ip)
    return {"token": auth.make_token(role), "role": role}


@router.get("/me")
def me(user: dict = Depends(auth.require_user)):
    settings = sheets.get_settings()
    name = settings["admin_name"] if user["role"] == "admin" else settings["father_name"]
    return {"role": user["role"], "name": name}
