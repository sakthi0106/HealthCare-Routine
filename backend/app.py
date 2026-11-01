"""FastAPI entry point."""
import logging
import os
import threading
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("app")

from routes import admin_data, auth, dashboard, medical_reports, medicines, trackers  # noqa: E402
from routes import push as push_routes  # noqa: E402
from services import push  # noqa: E402
from utils.errors import AppError  # noqa: E402


def _scheduler(stop: threading.Event) -> None:
    """Sends due reminders every minute while the server is awake (an outside cron also calls /api/cron/run)."""
    while not stop.wait(60):
        try:
            push.dispatch_due()
        except Exception:  # noqa: BLE001
            log.exception("Reminder scheduler error")


@asynccontextmanager
async def lifespan(_app):
    if len(os.getenv("JWT_SECRET", "")) < 16:
        log.warning("JWT_SECRET is missing or too short - logins will fail until it is set.")
    if os.getenv("ADMIN_PIN", "change-me") in ("", "change-me") or os.getenv("ADMIN_PIN") == os.getenv("FATHER_PIN"):
        log.warning("Set a unique ADMIN_PIN that differs from FATHER_PIN.")
    stop = threading.Event()
    if push.configured() and os.getenv("RUN_SCHEDULER", "true").lower() != "false":
        threading.Thread(target=_scheduler, args=(stop,), daemon=True).start()
        log.info("Background reminder scheduler started.")
    elif not push.configured():
        log.warning("VAPID keys are not set - background reminders are switched off.")
    yield
    stop.set()


app = FastAPI(title="Family Health Companion API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,   # login uses a token header, not cookies
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(AppError)
async def app_error_handler(_req: Request, exc: AppError):
    return JSONResponse(status_code=exc.status, content={"detail": exc.message})


@app.exception_handler(RequestValidationError)
async def validation_handler(_req: Request, exc: RequestValidationError):
    first = exc.errors()[0] if exc.errors() else {}
    field = str(first.get("loc", ["value"])[-1]).replace("_", " ")
    msg = str(first.get("msg", "is not valid")).replace("Value error, ", "")
    return JSONResponse(status_code=422, content={"detail": f"Please check the {field}: {msg}."})


@app.exception_handler(Exception)
async def unexpected_handler(_req: Request, exc: Exception):
    log.exception("Unexpected error")  # details stay in the server log only
    return JSONResponse(status_code=500, content={"detail": "Something went wrong. Please try again."})


@app.get("/")
def root():
    return {"app": "Family Health Companion API", "health": "/api/health"}


@app.get("/api/health")
def health_check():
    return {"status": "ok", "background_reminders": push.configured()}


for module in (auth, dashboard, medicines, trackers, admin_data, medical_reports, push_routes):
    app.include_router(module.router)
app.include_router(push_routes.cron_router)
