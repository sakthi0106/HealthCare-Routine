import { useState } from "react";
import useFetch from "../../hooks/useFetch";
import { api } from "../../services/api";
import { useToast } from "../../hooks/useToast";
import { Card, ErrorBox, Field, Loading, Modal } from "../../components/ui";
import { fmtDate, fmtShortDate, todayISO } from "../../utils/format";

const TONE = { ok: ["In stock", "ok"], low: ["LOW STOCK", "warn"], out: ["OUT OF STOCK", "danger"] };

export default function Inventory() {
  const toast = useToast();
  const inv = useFetch("/api/inventory");
  const buys = useFetch("/api/inventory/purchases");
  const [item, setItem] = useState(null);
  const [form, setForm] = useState({ quantity: "", date: todayISO(), notes: "" });
  const [busy, setBusy] = useState(false);

  const open = (i) => { setItem(i); setForm({ quantity: "", date: todayISO(), notes: "" }); };
  const save = async () => {
    setBusy(true);
    try {
      await api("/api/inventory/purchase", { method: "POST", body: { medicine_id: item.medicine_id, quantity: Number(form.quantity), date: form.date, notes: form.notes } });
      toast("Purchase recorded ✓");
      setItem(null);
      inv.reload();
      buys.reload();
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <h1>📦 Medicine Stock</h1>
      {inv.error && <ErrorBox message={inv.error} onRetry={inv.reload} />}
      {!inv.data && !inv.error && <Loading />}
      {inv.data && inv.data.items.length === 0 && <p className="muted center">Add medicines first.</p>}
      {inv.data && inv.data.items.map((i) => {
        const [label, tone] = TONE[i.state];
        return (
          <Card key={i.medicine_id} icon="💊" title={i.medicine_name} tone={i.state !== "ok" ? "warn" : undefined}>
            <span className={`badge badge-${tone}`}>{label}</span>
            <p className="big" style={{ marginTop: ".4rem" }}>{i.current_stock} <small>tablets left</small></p>
            <div className="row"><span>Reorder level</span><strong>{i.reorder_level}</strong></div>
            <div className="row"><span>Used per day</span><strong>{i.daily_quantity}</strong></div>
            <div className="row"><span>Days remaining (estimate)</span><strong>{i.estimated_days_remaining ?? "—"}</strong></div>
            <div className="row"><span>Estimated run-out date</span><strong>{i.run_out_date ? fmtDate(i.run_out_date) : "—"}</strong></div>
            {i.alert && <p className="alert alert-warn" style={{ marginTop: ".6rem" }}>{i.alert}</p>}
            <button className="btn btn-block" style={{ marginTop: ".6rem" }} onClick={() => open(i)}>Mark as Purchased</button>
          </Card>
        );
      })}

      <Card icon="🧾" title="Purchase history">
        {buys.data && buys.data.purchases.length === 0 && <p className="muted">No purchases recorded yet.</p>}
        {buys.data && buys.data.purchases.map((p) => (
          <div className="row" key={p.purchase_id}>
            <span>{fmtShortDate(p.date)} · {p.medicine_name}</span><strong>+{p.quantity_added}</strong>
          </div>
        ))}
      </Card>

      {item && (
        <Modal title={`Purchased: ${item.medicine_name}`} onClose={() => setItem(null)}>
          <Field label="Quantity purchased"><input type="number" inputMode="decimal" min="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} autoFocus /></Field>
          <Field label="Date"><input type="date" max={todayISO()} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
          <Field label="Notes"><input type="text" maxLength={300} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          <button className="btn btn-block" disabled={busy || !(Number(form.quantity) > 0)} onClick={save}>{busy ? "Saving…" : "Save purchase"}</button>
        </Modal>
      )}
    </>
  );
}
