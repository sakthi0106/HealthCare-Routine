"""
AI assistant.

Safety design (important):
1. A deterministic safety filter runs BEFORE any AI call. Questions about
   dosage, diagnosis, new medicines or serious symptoms get a fixed reply.
2. The AI can only call the read-only tools below. It never touches Google Sheets itself.
3. If OpenAI is not configured or fails, a simple keyword assistant answers
   from the same tools, so the feature still works.
"""
import json
import logging
import os
import re

from services import google_sheets as sheets
from services import inventory
from services import summary
from utils import timeutil as tu

log = logging.getLogger("ai")

# ------------------------------------------------------------------ safety filter
def _emergency_number() -> str:
    return os.getenv("EMERGENCY_NUMBER", "112")


SERIOUS = [r"chest pain", r"can.?t breathe", r"cannot breathe", r"(difficult|trouble|hard)\w* breathing",
           r"short(ness)? of breath", r"breathless", r"faint", r"unconscious", r"stroke", r"heart attack",
           r"seizure", r"collapse", r"bleeding", r"overdose", r"allergic reaction", r"suicid",
           r"\b(i|he|she|dad|father)\b.{0,20}\b(feel|feeling|am|is|have|has|having)\b.{0,25}"
           r"\b(pain|dizzy|dizziness|vomit\w*|fever|swelling|palpitation\w*|numb\w*|blurred|weak|unwell|sick)\b"]
DOSAGE = [r"should i (take|stop|skip|double|increase|reduce|halve|continue|change|have)",
          r"can i (take|stop|skip|double|have|mix|change)", r"\b(two|2|extra|double|more|another|half|less|fewer)\s+(tablet|pill|dose|capsule)s?",
          r"double (the )?dose", r"(stop|quit|discontinue)\s+(taking|my)", r"how (many|much).{0,30}\b(should|to)\b.{0,10}take",
          r"missed (a |my |the )?dose", r"forgot to take", r"\b(take|took)\b.{0,30}\b(twice|again)\b"]
DIAGNOSIS = [r"do i have", r"what (disease|illness|condition|infection)", r"diagnos", r"is it (serious|dangerous|cancer|diabetes)",
             r"what.{0,15}wrong with me", r"is (this|that) normal"]
NEW_MEDICINE = [r"recommend", r"suggest", r"prescribe", r"what (medicine|tablet|drug|pill)s? (for|should|can)",
                r"best (medicine|tablet|drug|painkiller)", r"\bantibiotic", r"\bpainkiller"]

REPLY_SERIOUS = (f"Please contact a qualified healthcare professional or emergency service. "
                 f"If this feels urgent, call your local emergency number ({_emergency_number()} in India) right away.")
REPLY_DOSAGE = ("I can't determine or change your prescribed dosage. Please follow the instructions "
                "provided by your doctor or pharmacist.")
REPLY_DIAGNOSIS = "I can't diagnose health conditions. Please speak with a qualified healthcare professional."
REPLY_NEW_MEDICINE = "I can't recommend, start or stop any medicine. Please ask your doctor or pharmacist."


def check_safety(message: str):
    text = message.lower()
    for patterns, reply in ((SERIOUS, REPLY_SERIOUS), (DOSAGE, REPLY_DOSAGE),
                            (DIAGNOSIS, REPLY_DIAGNOSIS), (NEW_MEDICINE, REPLY_NEW_MEDICINE)):
        if any(re.search(p, text) for p in patterns):
            return reply
    return None


# ------------------------------------------------------------------ tools (read-only)
def get_today_summary() -> dict:
    d = summary.dashboard()
    appt = d["next_appointment"]
    return {
        "date": d["date"],
        "medicines": {k: d["medicines"][k] for k in ("total", "taken", "skipped", "pending")},
        "water_ml": d["water"]["total_ml"], "water_target_ml": d["water"]["target_ml"],
        "walking_minutes": d["walking"]["total_minutes"], "walking_km": d["walking"]["total_km"],
        "respirometer": {"completed": d["respirometer"]["completed"], "total": d["respirometer"]["total"]},
        "next_appointment": appt,
        "low_stock": [{"medicine_name": i["medicine_name"], "current_stock": i["current_stock"], "state": i["state"]}
                      for i in d["low_stock"]],
    }


def get_medicine_status(slot: str = "") -> dict:
    items = sheets.get_today_medicine_schedule()
    slot = (slot or "").lower().strip()
    if slot:
        items = [i for i in items if i["slot"] == slot]
    return {"slot": slot or "all", "doses": [
        {"medicine_name": i["medicine_name"], "dosage": i["dosage"], "slot": i["slot"],
         "scheduled_time": i["scheduled_time"], "status": i["status"], "taken_time": i["taken_time"]} for i in items]}


def get_water_summary() -> dict:
    w = sheets.get_water_today()
    return {"total_ml": w["total_ml"], "target_ml": w["target_ml"], "entries_today": len(w["entries"])}


def get_walking_summary() -> dict:
    w = sheets.get_walking_today()
    return {k: w[k] for k in ("total_minutes", "total_km", "target_minutes", "target_km")}


def get_respirometer_status() -> dict:
    items = sheets.get_respirometer_schedule()
    s = sheets.summarize_sessions(items)
    return {"completed": s["completed"], "total": s["total"], "skipped": s["skipped"],
            "next_session": s["next"]["scheduled_time"] if s["next"] else None,
            "sessions": [{"scheduled_time": i["scheduled_time"], "status": i["status"],
                          "completed_time": i["completed_time"]} for i in items]}


def get_upcoming_appointments(limit: int = 3) -> dict:
    return {"appointments": sheets.get_appointments(upcoming_only=True)[: max(1, min(int(limit or 3), 10))]}


def get_low_stock_medicines() -> dict:
    return {"low_stock": [{"medicine_name": i["medicine_name"], "current_stock": i["current_stock"],
                           "state": i["state"], "estimated_days_remaining": i["estimated_days_remaining"]}
                          for i in inventory.get_low_stock_medicines()]}


TOOL_FUNCTIONS = {
    "get_today_summary": get_today_summary, "get_medicine_status": get_medicine_status,
    "get_water_summary": get_water_summary, "get_walking_summary": get_walking_summary,
    "get_respirometer_status": get_respirometer_status, "get_upcoming_appointments": get_upcoming_appointments,
    "get_low_stock_medicines": get_low_stock_medicines,
}


def _tool(name, description, props=None):
    return {"type": "function", "function": {"name": name, "description": description,
            "parameters": {"type": "object", "properties": props or {}, "additionalProperties": False}}}


TOOL_SCHEMAS = [
    _tool("get_today_summary", "Overview of today: medicines, water, walking, respirometer, next appointment, low stock."),
    _tool("get_medicine_status", "Today's medicine schedule with status (Pending/Taken/Skipped/Snoozed) and taken times.",
          {"slot": {"type": "string", "enum": ["morning", "afternoon", "evening", "night", ""],
                    "description": "Optional time of day to filter by"}}),
    _tool("get_water_summary", "Water drunk today versus the daily target."),
    _tool("get_walking_summary", "Walking minutes and distance today versus targets."),
    _tool("get_respirometer_status", "Today's respirometer sessions and which are done."),
    _tool("get_upcoming_appointments", "Upcoming doctor appointments.", {"limit": {"type": "integer"}}),
    _tool("get_low_stock_medicines", "Medicines that are running low or out of stock."),
]

SYSTEM_PROMPT = """You are the helper inside Family Health Companion, a routine-tracking app for an elderly person.
Use very simple, short, kind sentences.
RULES:
- Answer ONLY from data returned by your tools. If the tools return no record, say "I don't have a record" - never guess or invent records.
- Call a tool for every question about the person's routine. Do not answer from memory.
- Never diagnose, never recommend/start/stop/change any medicine or dose, never say whether something is an emergency,
  never contradict the doctor.
- For dosage questions say: "I can't determine or change your prescribed dosage. Please follow the instructions provided by your doctor or pharmacist."
- For symptoms or anything that sounds serious say: "Please contact a qualified healthcare professional or emergency service."
- You may share general non-medical help about using the app. Times are in 12-hour format (e.g. 1:17 PM)."""


# ------------------------------------------------------------------ keyword fallback
def _t12(hhmm):
    if not hhmm:
        return ""
    h, m = int(hhmm[:2]), int(hhmm[3:])
    return f"{h % 12 or 12}:{m:02d} {'PM' if h >= 12 else 'AM'}"


def _litres(ml):
    return f"{ml} ml" if ml < 1000 else f"{round(ml / 1000, 2)} L"


def _fallback(message: str) -> str:
    t = message.lower()
    if re.search(r"low|running|stock|remaining|refill|left|buy|purchase", t):
        low = get_low_stock_medicines()["low_stock"]
        if not low:
            return "None of your medicines are running low right now."
        return " ".join(f"{i['medicine_name']} is out of stock." if i["state"] == "out"
                        else f"{i['medicine_name']} is running low: {i['current_stock']} tablets remaining." for i in low)
    if re.search(r"appointment|doctor|check.?up|hospital|visit", t):
        appts = get_upcoming_appointments()["appointments"]
        if not appts:
            return "I don't have any upcoming appointments recorded."
        a = appts[0]
        return (f"Your next appointment is {a['purpose'] or a['department'] or 'a visit'}"
                f"{' with ' + a['doctor'] if a['doctor'] else ''} on {a['date']} at {_t12(a['time'])}"
                f"{' at ' + a['hospital'] if a['hospital'] else ''}.")
    if re.search(r"water|drink|drank", t):
        w = get_water_summary()
        return f"You have had {_litres(w['total_ml'])} of water today. Your target is {_litres(w['target_ml'])}."
    if re.search(r"walk|steps|distance", t):
        w = get_walking_summary()
        return f"Today you walked {w['total_minutes']} minutes and {w['total_km']} km."
    if re.search(r"respirometer|spirometer|breathing exercise|lung", t):
        r = get_respirometer_status()
        if not r["total"]:
            return "I don't have any respirometer sessions scheduled today."
        nxt = f" Your next session is at {_t12(r['next_session'])}." if r["next_session"] else ""
        return f"You have completed {r['completed']} of {r['total']} respirometer sessions today.{nxt}"
    if re.search(r"medicine|tablet|pill|schedule|took|taken|take", t):
        slot = next((s for s in ("morning", "afternoon", "evening", "night") if s in t), "")
        doses = get_medicine_status(slot)["doses"]
        if not doses:
            return f"I don't have any {slot + ' ' if slot else ''}medicines scheduled for today."
        lines = []
        for d in doses:
            if d["status"] == "Taken":
                lines.append(f"{d['medicine_name']} ({_t12(d['scheduled_time'])}): taken at {_t12(d['taken_time'])}.")
            elif d["status"] == "Skipped":
                lines.append(f"{d['medicine_name']} ({_t12(d['scheduled_time'])}): skipped.")
            else:
                lines.append(f"{d['medicine_name']} ({_t12(d['scheduled_time'])}): not recorded as taken yet.")
        return " ".join(lines)
    if re.search(r"reminder|today|summary|everything|how am i", t):
        s = get_today_summary()
        m, r = s["medicines"], s["respirometer"]
        return (f"Medicines: {m['taken']} of {m['total']} taken. Water: {_litres(s['water_ml'])}. "
                f"Walking: {s['walking_minutes']} min, {s['walking_km']} km. "
                f"Respirometer: {r['completed']} of {r['total']}.")
    return ("I can tell you about today's medicines, water, walking, respirometer, appointments and "
            "medicine stock. Try asking: \"Did I take my morning tablets?\"")


# ------------------------------------------------------------------ chat entry point
def chat(message: str, history=None) -> dict:
    message = message.strip()
    safe = check_safety(message)
    if safe:
        return {"reply": safe, "source": "safety"}

    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        return {"reply": _fallback(message), "source": "basic"}
    try:
        from openai import OpenAI

        client = OpenAI(api_key=api_key, timeout=25)
        messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        for turn in (history or [])[-6:]:
            if turn.get("role") in ("user", "assistant"):
                messages.append({"role": turn["role"], "content": str(turn.get("content", ""))[:500]})
        messages.append({"role": "user", "content": message})
        model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
        for _ in range(4):
            resp = client.chat.completions.create(model=model, messages=messages, tools=TOOL_SCHEMAS, temperature=0)
            msg = resp.choices[0].message
            if not msg.tool_calls:
                reply = (msg.content or "").strip()
                return {"reply": reply or _fallback(message), "source": "ai"}
            messages.append(msg)
            for call in msg.tool_calls:
                fn = TOOL_FUNCTIONS.get(call.function.name)
                try:
                    args = json.loads(call.function.arguments or "{}")
                    result = fn(**args) if fn else {"error": "unknown tool"}
                except Exception:  # noqa: BLE001
                    log.exception("Tool failed")
                    result = {"error": "data unavailable"}
                messages.append({"role": "tool", "tool_call_id": call.id,
                                 "content": json.dumps(result, default=str)})
        return {"reply": _fallback(message), "source": "basic"}
    except Exception:  # noqa: BLE001 - never show internals; fall back to the basic assistant
        log.exception("OpenAI call failed")
        return {"reply": _fallback(message), "source": "basic"}
