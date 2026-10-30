"""
Storage layer. Everything that touches Google Sheets lives in this one file.

Design notes (read this before changing anything):
- One batch request reads ALL tabs at once, and the result is cached for a few
  seconds. This keeps us well inside Google's per-minute API quota.
- Every write clears the cache. Updates/deletes re-read fresh data first so a
  row number can never be stale.
- Values are written as RAW text, so Google never turns "08:00" into a time
  or evaluates a note that starts with "=" as a formula.
- Columns are matched by header NAME, so reordering columns in the Sheet is safe.
"""
import base64
import functools
import json
import logging
import os
import threading
import time

import gspread
from google.oauth2.service_account import Credentials

from models.schema import SHEETS
from utils.errors import AppError

log = logging.getLogger("store")
SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]
CACHE_SECONDS = 8


class Store:
    """Interface used by the rest of the app (tests plug in an in-memory version)."""

    def read(self, sheet: str) -> list:
        raise NotImplementedError

    def append(self, sheet: str, record: dict) -> None:
        self.append_many(sheet, [record])

    def append_many(self, sheet: str, records: list) -> None:
        raise NotImplementedError

    def update(self, sheet: str, key_col: str, key, updates: dict) -> bool:
        raise NotImplementedError

    def delete(self, sheet: str, key_col: str, key) -> bool:
        raise NotImplementedError


def _guard(fn):
    """Turn any Google/network failure into a friendly error (details go to the log only)."""

    @functools.wraps(fn)
    def wrapper(self, *args, **kwargs):
        try:
            with self._lock:
                return fn(self, *args, **kwargs)
        except AppError:
            raise
        except Exception:  # noqa: BLE001 - we deliberately hide internals from users
            log.exception("Google Sheets operation failed")
            self._cache = None
            raise AppError("Unable to reach the data store. Please try again.", 503)

    return wrapper


class GoogleStore(Store):
    def __init__(self):
        self._lock = threading.RLock()
        self._book = None
        self._worksheets = {}
        self._headers = {}
        self._cache = None
        self._cache_at = 0.0

    # ---- connection ----
    def _open(self):
        if self._book is not None:
            return self._book
        raw = os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON", "").strip()
        sheet_id = os.getenv("GOOGLE_SHEET_ID", "").strip()
        if not raw or not sheet_id:
            raise AppError("The data store is not set up yet. Please contact the family admin.", 503)
        if not raw.startswith("{"):
            raw = base64.b64decode(raw).decode()
        creds = Credentials.from_service_account_info(json.loads(raw), scopes=SCOPES)
        book = gspread.authorize(creds).open_by_key(sheet_id)
        self._ensure_tabs(book)
        self._book = book
        return self._book

    @staticmethod
    def _ensure_tabs(book) -> None:
        """Adds any tab that a newer version of the app needs, so upgrades just work."""
        existing = {ws.title: ws for ws in book.worksheets()}
        for name, columns in SHEETS.items():
            if name not in existing:
                ws = book.add_worksheet(title=name, rows=1000, cols=len(columns))
                ws.update(values=[columns], range_name="A1", raw=True)
                ws.freeze(rows=1)
                log.info("Created missing sheet tab: %s", name)
                continue
            # tab exists: add any column a newer version of the app needs (e.g. interval_days)
            header = [str(h).strip() for h in existing[name].row_values(1)]
            missing = [c for c in columns if c not in header]
            if missing:
                start = gspread.utils.rowcol_to_a1(1, len(header) + 1)
                existing[name].update(values=[missing], range_name=start, raw=True)
                log.info("Added missing columns %s to %s", missing, name)

    def _ws(self, name: str):
        if name not in self._worksheets:
            self._worksheets[name] = self._open().worksheet(name)
        return self._worksheets[name]

    # ---- reading ----
    def _load(self, force: bool = False) -> dict:
        fresh = self._cache is not None and (time.monotonic() - self._cache_at) < CACHE_SECONDS
        if fresh and not force:
            return self._cache
        ranges = [f"'{name}'!A:Z" for name in SHEETS]
        response = self._open().values_batch_get(ranges)
        data = {}
        for name, value_range in zip(SHEETS, response.get("valueRanges", [])):
            rows = value_range.get("values", [])
            header = [str(h).strip() for h in rows[0]] if rows else []
            missing = [c for c in SHEETS[name] if c not in header]
            if missing:
                log.error("Sheet %s is missing columns %s - run scripts.setup_sheets", name, missing)
                raise AppError("The Google Sheet is not set up correctly. Please contact the family admin.", 500)
            self._headers[name] = header
            records = []
            for number, row in enumerate(rows[1:], start=2):
                if not any(str(cell).strip() for cell in row):
                    continue
                row = list(row) + [""] * (len(header) - len(row))
                record = {h: str(row[i]) for i, h in enumerate(header) if h}
                record["_row"] = number
                records.append(record)
            data[name] = records
        self._cache, self._cache_at = data, time.monotonic()
        return data

    @_guard
    def read(self, sheet):
        return [dict(r) for r in self._load()[sheet]]

    # ---- writing ----
    @_guard
    def append_many(self, sheet, records):
        if not records:
            return
        self._load()  # makes sure we know the real header order
        header = self._headers[sheet]
        rows = [[str(r.get(h, "")) for h in header] for r in records]
        self._ws(sheet).append_rows(rows, value_input_option="RAW", table_range="A1")
        self._cache = None

    @_guard
    def update(self, sheet, key_col, key, updates):
        records = self._load(force=True)[sheet]
        record = next((r for r in records if r.get(key_col) == str(key)), None)
        if record is None:
            return False
        header = self._headers[sheet]
        merged = {**record, **{k: str(v) for k, v in updates.items()}}
        self._ws(sheet).update(
            values=[[merged.get(h, "") for h in header]],
            range_name=f"A{record['_row']}",
            raw=True,
        )
        self._cache = None
        return True

    @_guard
    def delete(self, sheet, key_col, key):
        records = self._load(force=True)[sheet]
        record = next((r for r in records if r.get(key_col) == str(key)), None)
        if record is None:
            return False
        self._ws(sheet).delete_rows(record["_row"])
        self._cache = None
        return True


_store = None


def get_store() -> Store:
    global _store
    if _store is None:
        _store = GoogleStore()
    return _store


def set_store(store) -> None:
    """Used by tests to plug in an in-memory store."""
    global _store
    _store = store
