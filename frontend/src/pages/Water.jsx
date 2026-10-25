import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import useFetch from "../hooks/useFetch";
import { api } from "../services/api";
import { useToast } from "../hooks/useToast";
import { BarChart, Card, ErrorBox, Field, Loading, Modal, ProgressBar, TimeField } from "../components/ui";
import { fmtMl, fmtShortDate, fmtTime } from "../utils/format";

export default function Water() {
  const toast = useToast();
  const today = useFetch("/api/water/today");
  const hist = useFetch("/api/history?range=last30&parts=water");
  const [params, setParams] = useSearchParams();
  const [custom, setCustom] = useState(params.get("custom") === "1");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({ amount_ml: "", time: "" });

  const add = async (ml) => {
    setBusy(true);
    try {
      await api("/api/water", { method: "POST", body: { amount_ml: ml } });
      toast(`Added ${ml} ml 💧`);
      setCustom(false);
      setAmount("");
      setParams({});
      today.reload();
      hist.reload();
    } catch (e) {
      toast(e.message.startsWith("Please check") ? e.message : "Unable to save your water entry. Please try again.", "error");
    } finally {
      setBusy(false);
    }
  };

    const openEdit = (entry) => {
    setEditing(entry);
    setEditForm({ amount_ml: String(entry.amount_ml), time: entry.time });
  };

  const saveEdit = async () => {
    setBusy(true);
    try {
      await api(`/api/water/${editing.log_id}`, {
        method: "PUT",
        body: { amount_ml: Math.round(Number(editForm.amount_ml)), time: editForm.time || null },
      });
      toast("Water entry updated ✓");
      setEditing(null);
      today.reload();
      hist.reload();
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const w = today.data;
  const days = hist.data?.water.days || [];
  const last7 = days.slice(-7);
  const weeklyAvg = last7.length ? Math.round(last7.reduce((s, d) => s + d.total_ml, 0) / last7.length) : 0;

  return (
    <>
      <h1>💧 Water</h1>
      {today.error && <ErrorBox message={today.error} onRetry={today.reload} />}
      {!w && !today.error && <Loading />}
      {w && (
        <Card icon="💧" title="Today's Water">
          <p className="big">{fmtMl(w.total_ml)} <small>/ {fmtMl(w.target_ml)}</small></p>
          <ProgressBar value={w.total_ml} max={w.target_ml} label="Water progress" />
          <div className="btn-row">
            <button className="btn" disabled={busy} onClick={() => add(250)}>+250 ml</button>
            <button className="btn" disabled={busy} onClick={() => add(500)}>+500 ml</button>
            <button className="btn btn-outline" onClick={() => setCustom(true)}>Custom</button>
          </div>
          <h3 style={{ marginTop: "1rem" }}>Today's entries</h3>
          {w.entries.length === 0 && <p className="muted">Nothing recorded yet.</p>}
          {w.entries.map((e) => (
            <div className="row" key={e.log_id}><span>{fmtTime(e.time)}</span><strong>{e.amount_ml} ml</strong></div>
          ))}
        </Card>
      )}

      <Card icon="📈" title="History">
        {hist.error && <ErrorBox message={hist.error} onRetry={hist.reload} />}
        {hist.data && (
          <>
            <div className="tiles">
              <div className="tile"><b>{fmtMl(weeklyAvg)}</b><span>Daily average (last 7 days)</span></div>
              <div className="tile"><b>{fmtMl(hist.data.water.average_ml)}</b><span>Daily average (30 days)</span></div>
            </div>
            <BarChart data={days.map((d) => ({ label: fmtShortDate(d.date), value: d.total_ml }))} format={(v) => (v / 1000).toFixed(1)} unit=" L" />
            <p className="small muted center">Litres per day, last 30 days</p>
          </>
        )}
      </Card>

      {custom && (
        <Modal title="Add water" onClose={() => { setCustom(false); setParams({}); }}>
          <Field label="Amount in ml" hint="For example 200 for a small glass">
            <input type="number" inputMode="numeric" min="1" max="5000" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
          </Field>
          <button className="btn btn-block" disabled={busy || !(Number(amount) > 0)} onClick={() => add(Math.round(Number(amount)))}>Save</button>
        </Modal>
      )}
    </>
  );
}
