"""
One-time setup: creates every tab with its header row and default settings.

Usage (from the backend/ folder, with .env filled in):
    python -m scripts.setup_sheets

Safe to re-run: existing tabs and data are NOT overwritten.
"""
import base64
import json
import os
import sys

import gspread
from dotenv import load_dotenv
from google.oauth2.service_account import Credentials

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from models.schema import DEFAULT_SETTINGS, SHEETS  # noqa: E402

load_dotenv()
SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]


def load_credentials() -> Credentials:
    raw = os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON", "").strip()
    if not raw:
        sys.exit("GOOGLE_SERVICE_ACCOUNT_JSON is empty. Check backend/.env")
    if not raw.startswith("{"):          # allow base64 form
        raw = base64.b64decode(raw).decode()
    return Credentials.from_service_account_info(json.loads(raw), scopes=SCOPES)


def main() -> None:
    sheet_id = os.getenv("GOOGLE_SHEET_ID", "").strip()
    if not sheet_id:
        sys.exit("GOOGLE_SHEET_ID is empty. Check backend/.env")

    book = gspread.authorize(load_credentials()).open_by_key(sheet_id)
    existing = {ws.title: ws for ws in book.worksheets()}

    for name, columns in SHEETS.items():
        if name in existing:
            ws = existing[name]
            print(f"= {name}: already exists")
        else:
            ws = book.add_worksheet(title=name, rows=1000, cols=len(columns))
            print(f"+ {name}: created")
        if not ws.row_values(1):
            ws.update(range_name="A1", values=[columns])
            ws.freeze(rows=1)

    settings = book.worksheet("Settings")
    have = {r[0] for r in settings.get_all_values()[1:] if r}
    new_rows = [[k, v] for k, v in DEFAULT_SETTINGS.items() if k not in have]
    if new_rows:
        settings.append_rows(new_rows)
        print(f"+ Settings: added {len(new_rows)} default rows")

    if "Sheet1" in existing and not existing["Sheet1"].get_all_values():
        book.del_worksheet(existing["Sheet1"])
    print("\nDone. Your Google Sheet is ready.")


if __name__ == "__main__":
    main()
