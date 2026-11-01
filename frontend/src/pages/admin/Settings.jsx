import { useEffect, useState } from "react";
import useFetch from "../../hooks/useFetch";
import { api } from "../../services/api";
import { useToast } from "../../hooks/useToast";
import { Check, ErrorBox, Field, Loading, TimeField } from "../../components/ui";

export default function Settings() {
  const toast = useToast();
  const { data, error, reload } = useFetch("/api/settings");
  const [f, setF] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data) {
      setF({
        ...data,
        respirometer_sessions: data.respirometer_sessions || "",
        admin_name: data.admin_name || "Dhanushkumar A",
        father_name: data.father_name || "Ayyamperumal E",
      });
    }
  }, [data]);

  if (!f) return error ? <ErrorBox message={error} onRetry={reload} /> : <Loading />;

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const tick = (k) => (v) => setF({ ...f, [k]: v });
  const freq = Number(f.respirometer_frequency);

  const save = async () => {
    setBusy(true);
    try {
      await api("/api/settings", { method: "PUT", body: { values: f } });
      toast("Settings saved ✓");
      reload();
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <h1>⚙️ Settings</h1>
      <div className="alert alert-info">
        <p>Set every target and schedule from the doctor's instructions. The app does not choose medical values for you.</p>
      </div>

      <fieldset className="fieldset">
        <legend>User Profiles & Display Names</legend>
        <Field label="Father / Patient Display Name">
          <input type="text" value={f.father_name || ""} onChange={set("father_name")} maxLength={60} placeholder="e.g. Ayyamperumal E" />
        </Field>
        <Field label="Admin Display Name">
          <input type="text" value={f.admin_name || ""} onChange={set("admin_name")} maxLength={60} placeholder="e.g. Dhanushkumar A" />
        </Field>
      </fieldset>

      <fieldset className="fieldset"><legend>💧 Water and 🚶 walking targets</legend>
        <Field label="Water target per day (ml)"><input type="number" inputMode="numeric" value={f.water_target_ml} onChange={set("water_target_ml")} /></Field>
        <div className="grid2">
          <Field label="Walking target (minutes)"><input type="number" inputMode="decimal" value={f.walking_target_minutes} onChange={set("walking_target_minutes")} /></Field>
          <Field label="Walking target (km)"><input type="number" inputMode="decimal" step="0.1" value={f.walking_target_distance} onChange={set("walking_target_distance")} /></Field>
        </div>
      </fieldset>

      <fieldset className="fieldset"><legend>🫁 Respirometer</legend>
        <div className="grid2">
          <TimeField label="Start time" value={f.respirometer_start_time} onChange={(v) => setF({ ...f, respirometer_start_time: v })} defaultPeriod="AM" />
          <TimeField label="End time" value={f.respirometer_end_time} onChange={(v) => setF({ ...f, respirometer_end_time: v })} defaultPeriod="PM" />
        </div>
        <Field label="Every (minutes)" hint={freq > 0 ? `= every ${freq % 60 === 0 ? freq / 60 + " hour(s)" : freq + " minutes"}. The end time is included.` : "0 = spread the sessions below evenly"}>
          <input type="number" inputMode="numeric" min="0" value={f.respirometer_frequency} onChange={set("respirometer_frequency")} />
        </Field>
        <div className="grid2">
          <Field label="Max sessions per day" hint="Optional"><input type="number" inputMode="numeric" min="0" value={f.respirometer_sessions} onChange={set("respirometer_sessions")} /></Field>
          <Field label="Snooze (minutes)"><input type="number" inputMode="numeric" min="1" value={f.respirometer_snooze_minutes} onChange={set("respirometer_snooze_minutes")} /></Field>
        </div>
      </fieldset>

      <fieldset className="fieldset"><legend>💊 Medicine and 🏥 appointment reminders</legend>
        <Field label="Medicine snooze (minutes)"><input type="number" inputMode="numeric" min="1" value={f.medicine_snooze_minutes} onChange={set("medicine_snooze_minutes")} /></Field>
        <Field label="Default appointment reminders" hint='"7,1,2h" = 7 days, 1 day and 2 hours before'><input type="text" value={f.appointment_reminder_days} onChange={set("appointment_reminder_days")} /></Field>
      </fieldset>

      <fieldset className="fieldset"><legend>🔔 Notifications</legend>
        <Check label="Notifications on" checked={f.notification_enabled} onChange={tick("notification_enabled")} />
        <Check label="Medicine reminders" checked={f.notify_medicine} onChange={tick("notify_medicine")} />
        <Check label="Respirometer reminders" checked={f.notify_respirometer} onChange={tick("notify_respirometer")} />
        <Check label="Appointment reminders" checked={f.notify_appointments} onChange={tick("notify_appointments")} />
        <Check label="Low stock alerts" checked={f.notify_low_stock} onChange={tick("notify_low_stock")} />
        <Check label="Walking reminder" checked={f.notify_walking} onChange={tick("notify_walking")} />
        <TimeField label="Walking reminder time" value={f.walking_reminder_time} onChange={(v) => setF({ ...f, walking_reminder_time: v })} defaultPeriod="PM" />
        <Check label="Water reminders" checked={f.notify_water && f.water_reminder_enabled} onChange={(v) => setF({ ...f, notify_water: v, water_reminder_enabled: v })} />
        <div className="grid2">
          <TimeField label="Water reminders from" value={f.water_reminder_start_time} onChange={(v) => setF({ ...f, water_reminder_start_time: v })} defaultPeriod="AM" />
          <TimeField label="until" value={f.water_reminder_end_time} onChange={(v) => setF({ ...f, water_reminder_end_time: v })} defaultPeriod="PM" />
        </div>
        <Field label="Water reminder every (minutes)"><input type="number" inputMode="numeric" min="15" value={f.water_reminder_interval_minutes} onChange={set("water_reminder_interval_minutes")} /></Field>
      </fieldset>

      <button className="btn btn-block" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save settings"}</button>
    </>
  );
}
