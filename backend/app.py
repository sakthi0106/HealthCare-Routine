"""FastAPI entry point."""
import logging
import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("app")

from routes import admin_data, auth, dashboard, medicines, trackers  # noqa: E402
from utils.errors import AppError  # noqa: E402


@asynccontextmanager
async def lifespan(_app):
    if len(os.getenv("JWT_SECRET", "")) < 16:
        log.warning("JWT_SECRET is missing or too short - logins will fail until it is set.")
    if os.getenv("ADMIN_PIN", "change-me") in ("", "change-me") or os.getenv("ADMIN_PIN") == os.getenv("FATHER_PIN"):
        log.warning("Set a unique ADMIN_PIN that differs from FATHER_PIN.")
    yield


app = FastAPI(title="Family Health Companion API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()],
    allow_credentials=True,
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


@app.get("/api/health")
def health_check():
    return {"status": "ok"}


for module in (auth, dashboard, medicines, trackers, admin_data):
    app.include_router(module.router)
