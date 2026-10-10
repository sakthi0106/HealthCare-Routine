# Family Health Companion

A mobile-first PWA for daily health **routine tracking and reminders**: medicines, water, walking,
respirometer sessions, appointments, medicine stock, reports, and a safe AI helper.

> **Important:** this app is for routine tracking and reminders only. It does **not** diagnose,
> and it never recommends, changes or stops any medicine. Every dose, target and schedule is entered
> by the family from the doctor's instructions. It is not a replacement for professional medical advice.

**Stack:** React + Vite (frontend) · FastAPI (backend) · Google Sheets (data) · OpenAI (assistant, optional)

```
healthcare-routine/
├── frontend/   React app (pages/, components/, hooks/, services/, utils/, public/ = PWA files)
├── backend/    FastAPI (routes/, services/, models/, utils/, scripts/, tests/)
└── README.md
```

**Two logins (PINs set in `backend/.env`):** `FATHER_PIN` sees the simple daily screens. `ADMIN_PIN` (family) also manages
medicines, stock, appointments, settings and reports.

---

## 1. Install Node.js dependencies
Install Node.js 18+ from https://nodejs.org, then:
```bash
cd frontend
npm install
```

## 2. Install Python dependencies
Python 3.10+ required.
```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

## 3. Create the Google Sheet
1. Go to https://sheets.google.com and create a **blank spreadsheet** named `Family Health Companion`.
2. Copy the ID from its URL: `https://docs.google.com/spreadsheets/d/<THIS_PART>/edit` → this is `GOOGLE_SHEET_ID`.
3. Leave it blank. The setup script (step 9) creates all 8 tabs, headers and default settings:
   `Medicines, Medicine_Log, Water_Log, Walking_Log, Respirometer_Log, Appointments, Medicine_Purchases, Settings`.

## 4. Configure the Google Sheets API
1. Open https://console.cloud.google.com and create a project (e.g. `family-health`).
2. **APIs & Services → Library →** search **Google Sheets API → Enable**.

## 5. Create the Google service account
1. **APIs & Services → Credentials → Create credentials → Service account.** Name it `health-app`, click Done.
2. Open the service account → **Keys → Add key → Create new key → JSON.** A `.json` file downloads.
3. Keep that file private. Never commit it (`.gitignore` already blocks `service-account*.json` and `.env`).
4. Note the service account's email (looks like `health-app@your-project.iam.gserviceaccount.com`).

## 6. Share the Google Sheet with the service account
Open your Sheet → **Share** → paste the service-account email → role **Editor** → untick "Notify" → Share.

## 7. Configure environment variables
```bash
cd backend
cp .env.example .env
```
Edit `backend/.env`:

| Variable | What to put |
|---|---|
| `GOOGLE_SERVICE_ACCOUNT_JSON` | The whole JSON file contents on **one line, wrapped in single quotes**. Tip: `python -c "import json;print(json.dumps(json.load(open('key.json'))))"` |
| `GOOGLE_SHEET_ID` | ID from step 3 |
| `OPENAI_API_KEY` | From step 8 (optional) |
| `FATHER_PIN` / `ADMIN_PIN` | Two different PINs, e.g. 4–6 digits |
| `JWT_SECRET` | Long random text: `python -c "import secrets;print(secrets.token_urlsafe(48))"` |
| `APP_TIMEZONE` | `Asia/Kolkata` (change if needed) |
| `FATHER_NAME` | Default name for the greeting (can be changed later in Settings) |
| `CORS_ORIGINS` | `http://localhost:5173` locally; your Vercel/Netlify URL when deployed |

## 8. Configure the OpenAI API (optional)
1. Create a key at https://platform.openai.com/api-keys and put it in `OPENAI_API_KEY`.
2. `OPENAI_MODEL` defaults to `gpt-4o-mini`.
3. **No key?** The assistant still works using a simple built-in question matcher that reads the same data.
The safety filter (dosage, diagnosis, serious symptoms, new medicines) runs *before* any AI call in both modes.

## 9. Start the backend
```bash
cd backend
python -m scripts.setup_sheets      # one time: creates the tabs. Safe to re-run
uvicorn app:app --reload            # http://localhost:8000/api/health
```
If `setup_sheets` fails, check: Sheets API enabled, Sheet shared with the service-account email, and the JSON is on one line.
After updating the app later, re-run `setup_sheets` — it adds any new default settings without touching your data.

## 10. Start the frontend
In a second terminal:
```bash
cd frontend
npm run dev                         # http://localhost:5173
```
Sign in with the admin PIN → **Medicines → Add medicine** and **Settings** to enter the doctor's instructions.
During development `/api` calls are proxied to `localhost:8000`, so nothing else needs configuring.

## 11. Test the application
Automated backend tests (use an in-memory stand-in, no Google account needed):
```bash
cd backend
pip install -r requirements-dev.txt
python -m pytest -q                 # 25 tests: stock maths, validation, roles, reminders, AI safety
```
Manual checklist (admin PIN unless noted):
1. Add a medicine with a time a few minutes ago, 1 tablet/day, stock 3, reorder level 3 → Home shows **Due now** and a **low stock** alert.
2. Tap **✓ Taken** → status changes, stock drops by one dose, and a row appears in the `Medicine_Log` tab.
3. **Stock → Mark as Purchased** → stock increases; `Medicine_Purchases` gets a row.
4. Water **+250 ml**, a custom amount, and **Add Walking** (try start/end time) → totals update; try `0` or a negative number to see friendly errors.
5. **Settings** → change respirometer start/end/frequency → **Breathe** page schedule updates.
6. Add an appointment 1 day ahead → appears on Home and as an appointment reminder.
7. Tap **🤖 Ask** → try the example questions, then "Should I take two tablets?" (must refuse) and "I have chest pain" (must direct to a professional).
8. Sign in with the father PIN → admin pages are not shown.

## 12. Deploy the backend (Render)
1. Push the project to GitHub (check `.env` is **not** committed).
2. Render → **New → Web Service** → pick the repo → **Root Directory:** `backend`.
3. **Build command:** `pip install -r requirements.txt` · **Start command:** `uvicorn app:app --host 0.0.0.0 --port $PORT --workers 1`
4. Add every variable from step 7 under **Environment**. Set `CORS_ORIGINS` to your frontend URL (comma-separate several).
5. Deploy and open `https://<your-service>.onrender.com/api/health`.
(Railway works the same way; `backend/Procfile` is included.)

Notes: keep **one worker** (the Sheets cache and PIN rate-limiter live in memory). Render's free tier sleeps when idle, so the
first request can take ~30 s; a paid instance avoids that.

## 13. Deploy the frontend (Vercel or Netlify)
1. **Root directory:** `frontend` · **Build command:** `npm run build` · **Output directory:** `dist`
2. Add the environment variable `VITE_API_URL` = your backend URL, e.g. `https://<your-service>.onrender.com` (no trailing slash).
3. Deploy. `vercel.json` and `public/_redirects` already handle page refreshes.
4. Put the final frontend URL into the backend's `CORS_ORIGINS` and redeploy the backend.

## 14. Install the PWA on Android
1. Open the deployed HTTPS URL in **Chrome** on the phone and sign in.
2. Tap **⋮ → Install app** (or **Add to Home screen**). The app opens full-screen like a normal app.
3. On Home tap **Turn on reminders** and **Allow** notifications.

---

## How things work (for maintaining it)
- **Schema:** `backend/models/schema.py` is the one definition of all tabs/columns/default settings.
- **Sheets access:** only `backend/services/store.py` talks to Google. It reads all tabs in one request, caches ~8 s, and writes as plain text.
- **Business logic:** `services/google_sheets.py` (data functions), `inventory.py` (stock maths), `reminders.py`, `ai_assistant.py`, `summary.py` (dashboard/reports).
- **Stock rule:** marking a dose *Taken* subtracts `daily_quantity ÷ number of reminder times` (e.g. 2/day with 2 times = 1 per dose). Stock never goes below 0; tapping Taken twice never double-counts. Purchases add to stock.
- **Respirometer:** sessions run from start to end time **inclusive** at the chosen interval (08:00–20:00 every 2 h = 7 sessions).
- **Reports:** expected doses with no saved record (e.g. app not opened that day) are shown as "Pending / not recorded", so adherence is not overstated.
- **Add WhatsApp/SMS/email later:** add a class in `services/reminders.py` (see `WhatsAppChannel`) and call `dispatch()` from a scheduled job.
- **Android health data later:** walking is manual entry now; a future sync only needs to call `POST /api/walking`.

## Known limits (please read)
- **Reminders need the app to be opened.** The app checks for due reminders once a minute while it is open or in the background;
  Android may pause a closed PWA. For reminders that arrive with the app fully closed you need server-sent Web Push (or WhatsApp/SMS) — the channel structure is ready for it.
  Until then, set a phone alarm as a backup for critical medicines.
- Google Sheets allows ~60 reads/min per user; the cache keeps normal use well within that.
- PIN login suits a private family app. Use HTTPS (Render/Vercel provide it) and choose PINs that are not obvious.
