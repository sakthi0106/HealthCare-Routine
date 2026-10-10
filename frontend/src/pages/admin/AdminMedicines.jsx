import { useState } from "react";
import useFetch from "../../hooks/useFetch";
import { api } from "../../services/api";
import { useToast } from "../../hooks/useToast";
import { Card, Check, ErrorBox, Field, Loading, Modal } from "../../components/ui";
import { fmtTime } from "../../utils/format";

const EMPTY = { medicine_name: "", generic_name: "", dosage: "", frequency: "", morning_time: "", afternoon_time: "",
  evening_time: "", night_time: "", daily_quantity: "", current_stock: "", reorder_level: "", start_date: "", end_date: "",
  active: true, notes: "" };
const NUMBERS = ["daily_quantity", "current_stock", "reorder_level"];

export default function AdminMedicines() {
  const toast = useToast();
  const { data, error, reload } = useFetch("/api/medicines");
  const [editing, setEditing] = useState(null); // null | "new" | medicine
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const openNew = () => { setForm(EMPTY); setEditing("new"); };
  const openEdit = (m) => { setForm({ ...EMPTY, ...m }); setEditing(m); };

  const save = async () => {
    const body = { ...form };
    NUMBERS.forEach((k) => (body[k] = body[k] === "" ? 0 : Number(body[k])));
    delete body.medicine_id; delete body.dose_quantity;
    setBusy(true);
    try {
      if (editing === "new") await api("/api/medicines", { method: "POST", body });
      else await api(`/api/medicines/${editing.medicine_id}`, { method: "PUT", body });
      toast("Medicine saved ✓");
      setEditing(null);
      reload();
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (m) => {
    if (!window.confirm(`Delete ${m.medicine_name}? Past records stay in the history. To just stop reminders, mark it inactive instead.`)) return;
    try {
      await api(`/api/medicines/${m.medicine_id}`, { method: "DELETE" });
      toast("Medicine deleted");
      reload();
    } catch (e) {
      toast(e.message, "error");
    }
  };

  return (
    <>
      <h1>💊 Manage Medicines</h1>
      <div className="alert alert-info"><p>Enter exactly what the doctor prescribed. This app never suggests or changes doses.</p></div>
      <button className="btn btn-block" onClick={openNew}>+ Add medicine</button>
      <div style={{ height: "1rem" }} />
      {error && <ErrorBox message={error} onRetry={reload} />}
      {!data && !error && <Loading />}
      {data && data.medicines.length === 0 && <p className="muted center">No medicines yet.</p>}
      {data && data.medicines.map((m) => (
        <Card key={m.medicine_id} icon="💊" title={m.medicine_name}>
          <p className="muted">{m.medicine_id} {!m.active && <span className="badge badge-muted">Inactive</span>}</p>
          <div className="row"><span>Dosage</span><strong>{m.dosage || "—"}</strong></div>
          <div className="row"><span>Times</span><strong>{[["Morning", m.morning_time], ["Afternoon", m.afternoon_time], ["Evening", m.evening_time], ["Night", m.night_time]].filter(([, t]) => t).map(([n, t]) => `${n} ${fmtTime(t)}`).join(" · ") || "—"}</strong></div>
          <div className="row"><span>Per day</span><strong>{m.daily_quantity}</strong></div>
          <div className="row"><span>Stock / reorder at</span><strong>{m.current_stock} / {m.reorder_level}</strong></div>
          <div className="btn-row">
            <button className="btn btn-outline" onClick={() => openEdit(m)}>Edit</button>
            <button className="btn btn-outline" onClick={() => remove(m)}>Delete</button>
          </div>
        </Card>
      ))}

      {editing && (
        <Modal title={editing === "new" ? "Add medicine" : "Edit medicine"} onClose={() => setEditing(null)}>
          <Field label="Medicine name *"><input type="text" value={form.medicine_name} onChange={set("medicine_name")} maxLength={100} /></Field>
          <Field label="Generic name (optional)"><input type="text" value={form.generic_name} onChange={set("generic_name")} /></Field>
          <Field label="Dosage description" hint='As written by the doctor, e.g. "1 tablet after food"'><input type="text" value={form.dosage} onChange={set("dosage")} /></Field>
          <Field label="Frequency" hint='For your reference, e.g. "Twice daily"'><input type="text" value={form.frequency} onChange={set("frequency")} /></Field>
          <fieldset className="fieldset">
            <legend>Reminder times (leave blank to skip)</legend>
            <div className="grid2">
              <Field label="Morning"><input type="time" value={form.morning_time} onChange={set("morning_time")} /></Field>
              <Field label="Afternoon"><input type="time" value={form.afternoon_time} onChange={set("afternoon_time")} /></Field>
              <Field label="Evening"><input type="time" value={form.evening_time} onChange={set("evening_time")} /></Field>
              <Field label="Night"><input type="time" value={form.night_time} onChange={set("night_time")} /></Field>
            </div>
          </fieldset>
          <div className="grid2">
            <Field label="Tablets per day" hint="Used to count stock down"><input type="number" inputMode="decimal" min="0" step="0.5" value={form.daily_quantity} onChange={set("daily_quantity")} /></Field>
            <Field label="Current stock"><input type="number" inputMode="decimal" min="0" step="0.5" value={form.current_stock} onChange={set("current_stock")} /></Field>
            <Field label="Reorder level" hint="Warn at or below this"><input type="number" inputMode="decimal" min="0" value={form.reorder_level} onChange={set("reorder_level")} /></Field>
          </div>
          <div className="grid2">
            <Field label="Start date"><input type="date" value={form.start_date} onChange={set("start_date")} /></Field>
            <Field label="End date"><input type="date" value={form.end_date} onChange={set("end_date")} /></Field>
          </div>
          <Check label="Active (send reminders)" checked={form.active} onChange={(v) => setForm({ ...form, active: v })} />
          <Field label="Notes"><textarea value={form.notes} onChange={set("notes")} maxLength={500} /></Field>
          <button className="btn btn-block" disabled={busy || !form.medicine_name.trim()} onClick={save}>{busy ? "Saving…" : "Save"}</button>
        </Modal>
      )}
    </>
  );
}
