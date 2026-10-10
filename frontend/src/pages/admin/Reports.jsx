import { useState } from "react";
import useFetch from "../../hooks/useFetch";
import { BarChart, Card, ErrorBox, Loading } from "../../components/ui";
import { fmtDate, fmtMl, fmtShortDate } from "../../utils/format";

const VIEWS = [["today", "Daily"], ["week", "Weekly"], ["last30", "Monthly"]];

export default function Reports() {
  const [view, setView] = useState("today");
  const { data: h, error, reload } = useFetch(`/api/history?range=${view}`);
  const trend = view !== "today";

  return (
    <>
      <h1>📊 Reports</h1>
      <div className="tabs">
        {VIEWS.map(([k, label]) => <button key={k} className={`tab ${view === k ? "active" : ""}`} onClick={() => setView(k)}>{label}</button>)}
      </div>
      {error && <ErrorBox message={error} onRetry={reload} />}
      {!h && !error && <Loading />}
      {h && (
        <>
          <p className="muted">{h.start === h.end ? fmtDate(h.start) : `${fmtDate(h.start)} – ${fmtDate(h.end)}`}</p>

          <Card icon="💊" title="Medicines">
            <div className="tiles">
              <div className="tile"><b>{h.medicine.summary.scheduled}</b><span>Scheduled</span></div>
              <div className="tile"><b>{h.medicine.summary.taken}</b><span>Taken</span></div>
              <div className="tile"><b>{h.medicine.summary.skipped}</b><span>Skipped</span></div>
              <div className="tile"><b>{h.medicine.summary.pending + h.medicine.summary.snoozed}</b><span>Not recorded</span></div>
            </div>
            {trend && <BarChart data={h.medicine.days.map((d) => ({ label: fmtShortDate(d.date), value: d.taken }))} unit=" taken" />}
          </Card>

          <Card icon="💧" title="Water">
            <div className="tiles">
              <div className="tile"><b>{fmtMl(h.water.total_ml)}</b><span>Total</span></div>
              <div className="tile"><b>{fmtMl(h.water.average_ml)}</b><span>Daily average</span></div>
            </div>
            {trend && <BarChart data={h.water.days.map((d) => ({ label: fmtShortDate(d.date), value: d.total_ml }))} format={(v) => (v / 1000).toFixed(1)} unit=" L" />}
          </Card>

          <Card icon="🚶" title="Walking">
            <div className="tiles">
              <div className="tile"><b>{Math.round(h.walking.total_minutes)} min</b><span>Total time</span></div>
              <div className="tile"><b>{h.walking.total_km} km</b><span>Total distance</span></div>
              <div className="tile"><b>{h.walking.average_minutes} min</b><span>Daily average</span></div>
            </div>
            {trend && <BarChart data={h.walking.days.map((d) => ({ label: fmtShortDate(d.date), value: Math.round(d.minutes) }))} unit=" min" />}
          </Card>

          <Card icon="🫁" title="Respirometer">
            <div className="tiles">
              <div className="tile"><b>{h.respirometer.summary.completed}</b><span>Completed</span></div>
              <div className="tile"><b>{h.respirometer.summary.scheduled}</b><span>Scheduled</span></div>
              <div className="tile"><b>{h.respirometer.summary.skipped}</b><span>Skipped</span></div>
            </div>
            {trend && <BarChart data={h.respirometer.days.map((d) => ({ label: fmtShortDate(d.date), value: d.completed }))} unit=" done" />}
          </Card>
          <p className="small muted center">These are records of what was marked in the app. They are not a health score or medical advice. Days the app was not opened count as "not recorded".</p>
        </>
      )}
    </>
  );
}
