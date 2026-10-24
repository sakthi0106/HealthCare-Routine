import { useState } from "react";
import useFetch from "../../hooks/useFetch";
import { api } from "../../services/api";
import { useToast } from "../../hooks/useToast";
import { ErrorBox, Field, Loading, Modal, TimeField } from "../../components/ui";
import { AppointmentCard } from "../Appointments";

const EMPTY = { date: "", time: "", doctor: "", hospital: "", department: "", purpose: "", reminder_days: "7,1", status: "Scheduled", notes: "" };

export default function AdminAppointments() {
  const toast = useToast();
  const { data, error, reload } = useFetch("/api/appointments");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const save = async () => {
    setBusy(true);
    try {
      const body = { ...form };
      delete body.appointment_id;
      if (editing === "new") await api("/api/appointments", { method: "POST", body });
      else await api(`/api/appointments/${editing.appointment_id}`, { method: "PUT", body });
      toast("Appointment saved ✓");
      setEditing(null);
      reload();
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (a) => {
    if (!window.confirm("Delete this appointment?")) return;
    try {
      await api(`/api/appointments/${a.appointment_id}`, { method: "DELETE" });
      toast("Appointment deleted");
      reload();
    } catch (e) {
      toast(e.message, "error");
    }
  };

  return (
    <>
      <h1>🏥 Appointments</h1>
      <button className="btn btn-block" onClick={() => { setForm(EMPTY); setEditing("new"); }}>+ Add appointment</button>
      <div style={{ height: "1rem" }} />
      {error && <ErrorBox message={error} onRetry={reload} />}
      {!data && !error && <Loading />}
      {data && data.appointments.length === 0 && <p className="muted center">No appointments yet.</p>}
      {data && data.appointments.map((a) => (
        <AppointmentCard key={a.appointment_id} a={a}>
          <p className="small muted">{a.status} · reminders: {a.reminder_days || "default"}</p>
          <div className="btn-row">
            <button className="btn btn-outline" onClick={() => { setForm({ ...EMPTY, ...a }); setEditing(a); }}>Edit</button>
            <button className="btn btn-outline" onClick={() => remove(a)}>Delete</button>
          </div>
        </AppointmentCard>
      ))}

      {editing && (
        <Modal title={editing === "new" ? "Add appointment" : "Edit appointment"} onClose={() => setEditing(null)}>
          <div className="grid2">
            <Field label="Date *"><input type="date" value={form.date} onChange={set("date")} /></Field>
            <TimeField label="Time *" value={form.time} onChange={(v) => setForm({ ...form, time: v })} defaultPeriod="AM" />
          </div>
          <Field label="Doctor"><input type="text" value={form.doctor} onChange={set("doctor")} /></Field>
          <Field label="Hospital"><input type="text" value={form.hospital} onChange={set("hospital")} /></Field>
          <Field label="Department"><input type="text" value={form.department} onChange={set("department")} /></Field>
          <Field label="Purpose"><input type="text" value={form.purpose} onChange={set("purpose")} /></Field>
          <Field label="Reminders" hint='Days or hours before. "7,1,2h" = 7 days, 1 day and 2 hours before'>
            <input type="text" value={form.reminder_days} onChange={set("reminder_days")} />
          </Field>
          <Field label="Status">
            <select value={form.status} onChange={set("status")}>
              <option>Scheduled</option><option>Completed</option><option>Cancelled</option>
            </select>
          </Field>
          <Field label="Notes"><textarea value={form.notes} onChange={set("notes")} maxLength={500} /></Field>
          <button className="btn btn-block" disabled={busy || !form.date || !form.time} onClick={save}>{busy ? "Saving…" : "Save"}</button>
        </Modal>
      )}
    </>
  );
}
