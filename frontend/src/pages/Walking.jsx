import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import useFetch from "../hooks/useFetch";
import { api } from "../services/api";
import { useToast } from "../hooks/useToast";
import { BarChart, Card, ErrorBox, Field, Loading, Modal, ProgressBar, TimeField } from "../components/ui";
import { fmtShortDate, fmtTime, todayISO } from "../utils/format";

const EMPTY = { date: todayISO(), start_time: "", end_time: "", duration_minutes: "", distance_km: "", notes: "" };

export default function Walking() {
  const toast = useToast();
  const today = useFetch("/api/walking/today");
  const hist = useFetch("/api/history?range=last30&parts=walking");
  const [params, setParams] = useSearchParams();
  const [open, setOpen] = useState(params.get("add") === "1");
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const close = () => { setOpen(false); setParams({}); };
  const save = async () => {
    if (!form.duration_minutes && !(form.start_time && form.end_time)) {
      toast("Please enter how long you walked, or the start and end time.", "error");
      return;
    }
    setBusy(true);
    try {
      await api("/api/walking", { method: "POST", body: {
        date: form.date, start_time: form.start_time || null, end_time: form.end_time || null,
        duration_minutes: form.duration_minutes ? Number(form.duration_minutes) : null,
        distance_km: form.distance_km ? Number(form.distance_km) : 0, notes: form.notes } });
      toast("Walk saved 🚶");
      close();
      setForm(EMPTY);
      today.reload();
      hist.reload();
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const t = today.data;
  const days = hist.data?.walking.days || [];
  const week = days.slice(-7);
  const wk = {
    minutes: Math.round(week.reduce((s, d) => s + d.minutes, 0)),
    km: +week.reduce((s, d) => s + d.km, 0).toFixed(2),
  };

  return (
    <>
      <h1>🚶 Walking</h1>
      {today.error && <ErrorBox message={today.error} onRetry={today.reload} />}
      {!t && !today.error && <Loading />}
      {t && (
        <Card icon="🚶" title="Today's Walking">
          <p className="big">{t.total_minutes} <small>minutes</small><br />{t.total_km} <small>km</small></p>
          {t.target_minutes > 0 && <ProgressBar value={t.total_minutes} max={t.target_minutes} label="Walking progress" />}
          {t.target_minutes > 0 && <p className="muted">Target: {t.target_minutes} min{t.target_km ? ` · ${t.target_km} km` : ""}</p>}
          <button className="btn btn-block" onClick={() => setOpen(true)}>+ Add Walking</button>
          {t.entries.map((e) => (
            <div className="row" key={e.log_id}>
              <span>{e.start_time ? fmtTime(e.start_time) : "Walk"}{e.notes ? ` · ${e.notes}` : ""}</span>
              <strong>{e.duration_minutes} min · {e.distance_km} km</strong>
            </div>
          ))}
        </Card>
      )}

      <Card icon="📈" title="Summary">
        {hist.error && <ErrorBox message={hist.error} onRetry={hist.reload} />}
        {hist.data && (
          <>
            <h3>Last 7 days</h3>
            <div className="tiles">
              <div className="tile"><b>{wk.minutes} min</b><span>Total time</span></div>
              <div className="tile"><b>{wk.km} km</b><span>Total distance</span></div>
              <div className="tile"><b>{Math.round(wk.minutes / 7)} min</b><span>Daily average</span></div>
            </div>
            <h3>Last 30 days</h3>
            <div className="tiles">
              <div className="tile"><b>{Math.round(hist.data.walking.total_minutes)} min</b><span>Total time</span></div>
              <div className="tile"><b>{hist.data.walking.total_km} km</b><span>Total distance</span></div>
            </div>
            <BarChart data={days.map((d) => ({ label: fmtShortDate(d.date), value: Math.round(d.minutes) }))} unit=" min" />
            <p className="small muted center">Minutes walked per day</p>
          </>
        )}
      </Card>

      {open && (
        <Modal title="Add Walking" onClose={close}>
          <Field label="Date"><input type="date" max={todayISO()} value={form.date} onChange={set("date")} /></Field>
          <div className="grid2">
            <TimeField label="Start time" value={form.start_time} onChange={(v) => setForm({ ...form, start_time: v })} defaultPeriod="AM" />
            <TimeField label="End time" value={form.end_time} onChange={(v) => setForm({ ...form, end_time: v })} defaultPeriod="AM" />
          </div>
          <Field label="OR duration (minutes)"><input type="number" inputMode="decimal" min="0" value={form.duration_minutes} onChange={set("duration_minutes")} /></Field>
          <Field label="Distance (km)"><input type="number" inputMode="decimal" min="0" step="0.1" value={form.distance_km} onChange={set("distance_km")} /></Field>
          <Field label="Notes (optional)"><input type="text" maxLength={300} value={form.notes} onChange={set("notes")} /></Field>
          <button className="btn btn-block" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save"}</button>
        </Modal>
      )}
    </>
  );
}
