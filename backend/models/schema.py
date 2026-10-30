"""
Google Sheets schema - the ONE place that defines every tab and its columns.
Both the setup script and google_sheets.py read from here, so if you add a
column, change it here only.
"""

SHEETS = {
    "Medicines": [
        "medicine_id", "medicine_name", "generic_name", "dosage", "frequency",
        "morning_time", "afternoon_time", "evening_time", "night_time",
        "daily_quantity", "current_stock", "reorder_level",
        "start_date", "end_date", "active", "notes", "interval_days",
    ],
    "Medicine_Log": [
        "log_id", "date", "medicine_id", "medicine_name",
        "scheduled_time", "status", "taken_time", "notes",
    ],
    "Water_Log": ["log_id", "date", "time", "amount_ml"],
    "Walking_Log": [
        "log_id", "date", "start_time", "duration_minutes", "distance_km", "notes",
    ],
    "Respirometer_Log": [
        "log_id", "date", "scheduled_time", "completed_time", "status", "notes",
    ],
    "Appointments": [
        "appointment_id", "date", "time", "doctor", "hospital", "department",
        "purpose", "reminder_days", "status", "notes",
    ],
    "Medicine_Purchases": [
        "purchase_id", "date", "medicine_id", "medicine_name",
        "quantity_added", "notes",
    ],
    "Settings": ["setting", "value"],
    # used for background (push) reminders
    "Push_Subscriptions": ["endpoint", "p256dh", "auth", "role", "created_at"],
    "Notification_Log": ["notification_id", "sent_at"],
}
# Placeholders ONLY - set real values from the doctor's instructions in the app.
DEFAULT_SETTINGS = {
    "water_target_ml": "2500",
    "walking_target_minutes": "30",
    "walking_target_distance": "2",
    "respirometer_start_time": "08:00",
    "respirometer_end_time": "20:00",
    "respirometer_frequency": "120",        # minutes between sessions
    "respirometer_snooze_minutes": "15",
    "medicine_snooze_minutes": "15",
    "notification_enabled": "true",
    "appointment_reminder_days": "7,1",     # "7,1,2h" = 7 days, 1 day, 2 hours before
    "respirometer_sessions": "",            # optional: max sessions per day (blank = use frequency)
    "father_name": "",                      # shown in the greeting (blank = FATHER_NAME from .env)
    # notification switches
    "notify_medicine": "true",
    "notify_water": "true",
    "notify_walking": "true",
    "notify_respirometer": "true",
    "notify_appointments": "true",
    "notify_low_stock": "true",
    "water_reminder_enabled": "true",
    "water_reminder_interval_minutes": "120",
    "water_reminder_start_time": "09:00",
    "water_reminder_end_time": "20:00",
    "walking_reminder_time": "17:00",
}

MEDICINE_STATUSES = ["Pending", "Taken", "Skipped", "Snoozed"]
RESPIROMETER_STATUSES = ["Pending", "Completed", "Skipped", "Snoozed"]
APPOINTMENT_STATUSES = ["Scheduled", "Completed", "Cancelled"]
