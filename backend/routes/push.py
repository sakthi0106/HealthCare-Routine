import hmac
import os

from fastapi import APIRouter, Depends, Header
from pydantic import BaseModel, Field

from services import push
from utils.auth import require_user
from utils.errors import AppError

router = APIRouter(prefix="/api/push", tags=["push"])
cron_router = APIRouter(tags=["cron"])


class Keys(BaseModel):
    p256dh: str = Field(min_length=10, max_length=300)
    auth: str = Field(min_length=5, max_length=100)


class SubscriptionIn(BaseModel):
    endpoint: str = Field(min_length=20, max_length=1500, pattern=r"^https://")
    keys: Keys


class EndpointIn(BaseModel):
    endpoint: str = Field(min_length=20, max_length=1500)


@router.get("/public-key")
def public_key(_user: dict = Depends(require_user)):
    if not push.configured():
        raise AppError("Background reminders are not set up on the server yet.", 503)
    return {"publicKey": push.public_key()}


@router.post("/subscribe")
def subscribe(body: SubscriptionIn, user: dict = Depends(require_user)):
    push.save_subscription(body.model_dump(), user["role"])
    return {"subscribed": True}


@router.post("/unsubscribe")
def unsubscribe(body: EndpointIn, _user: dict = Depends(require_user)):
    push.remove_subscription(body.endpoint)
    return {"subscribed": False}


@router.post("/test")
def test(body: EndpointIn, _user: dict = Depends(require_user)):
    if not push.configured():
        raise AppError("Background reminders are not set up on the server yet.", 503)
    result = push.send_test(body.endpoint)
    if result == "unknown":
        raise AppError("This phone is not registered for reminders yet. Tap 'Turn on reminders' first.", 404)
    if result != "ok":
        raise AppError("The test could not be sent. Please try again.", 502)
    return {"sent": True}


@cron_router.api_route("/api/cron/run", methods=["GET", "POST", "HEAD"])
def run_scheduler(key: str = "", x_cron_key: str = Header(default="")):
    """Called every minute by an outside scheduler (cron-job.org). It also keeps a free Render server awake."""
    secret = os.getenv("CRON_SECRET", "")
    if not secret:
        raise AppError("Scheduled reminders are not switched on.", 503)
    given = key or x_cron_key
    if not hmac.compare_digest(given.encode(), secret.encode()):
        raise AppError("Not allowed.", 403)
    return push.dispatch_due()
