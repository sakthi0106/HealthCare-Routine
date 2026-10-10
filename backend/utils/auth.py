"""Simple PIN login for a family app. Two roles: 'father' and 'admin'."""
import hmac
import os
import time
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from fastapi import Depends, Header
from jose import JWTError, jwt

from utils.errors import AppError

ALGORITHM = "HS256"
TOKEN_DAYS = 30            # an elderly user should not have to sign in often
MAX_FAILS = 5              # wrong PINs allowed per window
WINDOW_SECONDS = 300

_fails = defaultdict(list)  # ip -> list of timestamps


def _secret() -> str:
    secret = os.getenv("JWT_SECRET", "")
    if len(secret) < 16:
        raise AppError("The server is not set up correctly. Please contact the family admin.", 500)
    return secret


def check_rate_limit(ip: str) -> None:
    now = time.time()
    _fails[ip] = [t for t in _fails[ip] if now - t < WINDOW_SECONDS]
    if len(_fails[ip]) >= MAX_FAILS:
        raise AppError("Too many wrong PIN attempts. Please wait a few minutes and try again.", 429)


def register_failure(ip: str) -> None:
    _fails[ip].append(time.time())


def clear_failures(ip: str) -> None:
    _fails.pop(ip, None)


def role_for_pin(pin: str):
    admin_pin = os.getenv("ADMIN_PIN", "")
    father_pin = os.getenv("FATHER_PIN", "")
    pin = (pin or "").strip()
    if admin_pin and hmac.compare_digest(pin.encode(), admin_pin.encode()):
        return "admin"
    if father_pin and hmac.compare_digest(pin.encode(), father_pin.encode()):
        return "father"
    return None


def make_token(role: str) -> str:
    exp = datetime.now(timezone.utc) + timedelta(days=TOKEN_DAYS)
    return jwt.encode({"role": role, "exp": exp}, _secret(), algorithm=ALGORITHM)


def require_user(authorization: str = Header(default=None)) -> dict:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise AppError("Please sign in.", 401)
    try:
        payload = jwt.decode(authorization[7:], _secret(), algorithms=[ALGORITHM])
    except JWTError:
        raise AppError("Your session has ended. Please sign in again.", 401)
    if payload.get("role") not in ("father", "admin"):
        raise AppError("Please sign in.", 401)
    return {"role": payload["role"]}


def require_admin(user: dict = Depends(require_user)) -> dict:
    if user["role"] != "admin":
        raise AppError("Only the family admin can do this.", 403)
    return user
