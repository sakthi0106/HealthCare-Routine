import { useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import useFetch from "../hooks/useFetch";
import { api } from "../services/api";
import { useToast } from "../hooks/useToast";
import { Card, ErrorBox, Field, Loading, Modal, ProgressBar, TimeField } from "../components/ui";
import { WaterChart } from "../components/charts";
import { fmtMl, fmtShortDate, fmtTime } from "../utils/format";

const WATER_BTNS = [50, 100, 150, 200, 250, 500];

export default function Water() {
  const toast   = useToast();
  const today   = useFetch("/api/water/today",                           { interval: 30000 });
  const hist    = useFetch("/api/history?range=last30&parts=water",       { interval: 60000 });
  const [params, setParams] = useSearchParams();
  const [custom,   setCustom]  = useState(params.get("custom") === "1");
  const [amount,   setAmount]  = useState("");
  const [editing,  setEditing] = useState(null);
  const [editForm, setEditForm]= useState({ amount_ml: "", time: "" });
  const busyRef = useRef(false);
  const [activeMl, setActiveMl] = useState(null);
  const [editBusy, setEditBusy] = useState(false);

  const add = async (ml) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setActiveMl(ml);
    try {
      await api("/api/water", { method: "POST", body: { amount_ml: ml } });
      toast(`💧 Added ${ml >= 1000 ? fmtMl(ml) : ml + " ml"}`);
      setCustom(false);
      setAmount("");
      setParams({});
      today.reload();
      hist.reload();
    } catch (e) {
      toast(e.message.startsWith("Please check") ? e.message : "Unable to save your water entry. Please try again.", "error");
    } finally {
      busyRef.current = false;
      setActiveMl(null);
    }
  };

  const openEdit = (entry) => {
    setEditing(entry);
    setEditForm({ amount_ml: String(entry.amount_ml), time: entry.time });
  };

  const saveEdit = async () => {
    setEditBusy(true);
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
      setEditBusy(false);
    }
  };

  const remove = async (entry) => {
    if (!window.confirm(`Delete ${entry.amount_ml} ml at ${fmtTime(entry.time)}?`)) return;
    try {
      await api(`/api/water/${entry.log_id}`, { method: "DELETE" });
      toast("Water entry deleted");
      today.reload();
      hist.reload();
    } catch (err) {
      toast(err.message, "error");
    }
  };

  const w      = today.data;
  const days   = hist.data?.water.days || [];
  const last7  = days.slice(-7);
  const weeklyAvg = last7.length ? Math.round(last7.reduce((s, d) => s + d.total_ml, 0) / last7.length) : 0;
  const pct = w ? Math.min(100, Math.round((w.total_ml * 100) / (w.target_ml || 1))) : 0;

  return (
    <>
      <h1>💧 Water Intake</h1>
      {today.error && <ErrorBox message={today.error} onRetry={today.reload} />}
      {!w && !today.error && <Loading />}

      {w && (
        <Card icon="💧" title="Today's Water">
          {/* Big progress display */}
          <div style={{ textAlign: "center", marginBottom: ".8rem" }}>
            <p className="big">{fmtMl(w.total_ml)} <small>/ {fmtMl(w.target_ml)}</small></p>
            <p className="small muted">{pct}% of daily goal reached</p>
          </div>
          <ProgressBar value={w.total_ml} max={w.target_ml} label="Water progress" />

          {/* Quick-add grid */}
          <p className="small muted" style={{ marginTop: ".8rem", marginBottom: ".3rem", fontWeight: 700 }}>Quick Add</p>
          <div className="water-btn-grid">
            {WATER_BTNS.map((ml) => (
              <button
                key={ml}
                className="water-btn"
                disabled={activeMl !== null}
                onClick={() => add(ml)}
                aria-label={`Add ${ml} ml`}
              >
                {activeMl === ml ? "…" : `+${ml} ml`}
              </button>
            ))}
          </div>
          <div style={{ marginTop: ".6rem" }}>
            <button className="btn btn-outline btn-small" onClick={() => setCustom(true)}>
              + Custom amount
            </button>
          </div>

          {/* Today's history */}
          <h3 style={{ marginTop: "1.2rem", marginBottom: ".6rem" }}>Today's Entries</h3>
          {w.entries.length === 0 && <p className="muted">Nothing recorded yet. Add your first glass! 💧</p>}
          {w.entries.map((e) => (
            <div className="row" key={e.log_id}>
              <span className="small muted">{fmtTime(e.time)}</span>
              <span style={{ display: "flex", alignItems: "center", gap: ".4rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
                <strong>{e.amount_ml} ml</strong>
                <button className="btn btn-small btn-outline" onClick={() => openEdit(e)}>Edit</button>
                <button className="btn btn-small btn-outline btn-danger" style={{ background: "transparent" }} onClick={() => remove(e)}>✕</button>
              </span>
            </div>
          ))}
        </Card>
      )}

      {/* ── History charts ────────────────────────── */}
      <Card icon="📈" title="History">
        {hist.error && <ErrorBox message={hist.error} onRetry={hist.reload} />}
        {hist.data && (
          <>
            <div className="tiles">
              <div className="tile"><b>{fmtMl(weeklyAvg)}</b><span>7-day average</span></div>
              <div className="tile"><b>{fmtMl(hist.data.water.average_ml)}</b><span>30-day average</span></div>
            </div>
            <WaterChart days={days} target={w?.target_ml} />
            <p className="small muted center">Litres per day · last 30 days</p>
          </>
        )}
      </Card>

      {/* Custom amount modal */}
      {custom && (
        <Modal title="Add Water" onClose={() => { setCustom(false); setParams({}); }}>
          <Field label="Amount in ml" hint="e.g. 200 ml for a small glass">
            <input
              type="number" inputMode="numeric" min="1" max="5000"
              value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus
            />
          </Field>
          <button
            className="btn btn-block"
            disabled={activeMl !== null || !(Number(amount) > 0)}
            onClick={() => add(Math.round(Number(amount)))}
          >
            Save
          </button>
        </Modal>
      )}

      {/* Edit modal */}
      {editing && (
        <Modal title="Edit Water Entry" onClose={() => setEditing(null)}>
          <Field label="Amount in ml">
            <input
              type="number" inputMode="numeric" min="1" max="5000"
              value={editForm.amount_ml}
              onChange={(e) => setEditForm({ ...editForm, amount_ml: e.target.value })}
              autoFocus
            />
          </Field>
          <TimeField
            label="Time"
            value={editForm.time}
            onChange={(v) => setEditForm({ ...editForm, time: v })}
            defaultPeriod="AM"
          />
          <button
            className="btn btn-block"
            disabled={editBusy || !(Number(editForm.amount_ml) > 0)}
            onClick={saveEdit}
          >
            {editBusy ? "Saving…" : "Save Changes"}
          </button>
        </Modal>
      )}
    </>
  );
}
