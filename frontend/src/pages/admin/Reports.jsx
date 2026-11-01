import { useEffect, useState } from "react";
import useFetch from "../../hooks/useFetch";
import { Card, ErrorBox, Loading } from "../../components/ui";
import {
  BloodSugarChart,
  MedicineChart,
  OverallHealthChart,
  RespirometerChart,
  TodayProgressChart,
  WalkingChart,
  WaterChart,
} from "../../components/charts";
import { fmtDate, fmtMl } from "../../utils/format";

const VIEWS = [
  ["today",  "Daily"],
  ["week",   "Weekly"],
  ["last30", "Monthly"],
];
const LIVE_MS = 15000;

export default function Reports() {
  const [view, setView] = useState("today");
  const [live, setLive] = useState(true);
  const [updatedAt, setUpdatedAt] = useState(null);
  const { data: h, error, reload } = useFetch(`/api/history?range=${view}`, { interval: live ? LIVE_MS : 0 });
  const settings = useFetch("/api/settings", { interval: live ? 60000 : 0 }).data;

  useEffect(() => { if (h) setUpdatedAt(new Date()); }, [h]);
  useEffect(() => {
    const onVisible = () => document.visibilityState === "visible" && live && reload();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  });

  const trend = view !== "today";

  return (
    <>
      <div className="reports-header">
        <h1>📊 Healthcare Analytics</h1>
      </div>

      <div className="tabs">
        {VIEWS.map(([k, label]) => (
          <button key={k} className={`tab ${view === k ? "active" : ""}`} onClick={() => setView(k)}>
            {label}
          </button>
        ))}
      </div>

      <div className="live-row">
        <button className="btn btn-small btn-outline live-pill" onClick={() => setLive(!live)} aria-pressed={live}>
          <span className={`live-dot ${live ? "" : "off"}`} aria-hidden="true" />
          {live ? "Live: on" : "Live: paused"}
        </button>
        <span className="small muted" role="status">
          {updatedAt ? `Updated ${updatedAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : "Loading…"}
          {live ? " · refreshes every 15s" : ""}
        </span>
        {!live && <button className="btn btn-small btn-outline" onClick={reload}>Refresh now</button>}
      </div>

      {error && <ErrorBox message={error} onRetry={reload} />}
      {!h && !error && <Loading />}

      {h && (
        <>
          <p className="muted">{h.start === h.end ? fmtDate(h.start) : `${fmtDate(h.start)} – ${fmtDate(h.end)}`}</p>

          {/* Overall healthcare activity analysis */}
          <Card icon="🏆" title="Overall Healthcare Adherence">
            <OverallHealthChart
              medicineSummary={h.medicine?.summary}
              waterSummary={{ total_ml: h.water?.total_ml, target: (settings?.water_target_ml || 2500) * (h.days_in_range || 1) }}
              walkingSummary={{ total_minutes: h.walking?.total_minutes, target: (settings?.walking_target_minutes || 30) * (h.days_in_range || 1) }}
              respSummary={h.respirometer?.summary}
            />
          </Card>

          {!trend && (
            <Card icon="🎯" title="Today's Progress">
              <TodayProgressChart
                medicines={{ taken: h.medicine.summary.taken, total: h.medicine.summary.scheduled }}
                water={{ ml: h.water.total_ml, target: settings?.water_target_ml }}
                walking={{ minutes: h.walking.total_minutes, target: settings?.walking_target_minutes }}
                respirometer={{ completed: h.respirometer.summary.completed, total: h.respirometer.summary.scheduled }}
              />
            </Card>
          )}

          {/* Blood Sugar Tests & Trends */}
          <Card icon="🩸" title="Blood Sugar Measurements & Trends">
            <div className="tiles">
              <div className="tile">
                <b>{h.blood_sugar?.average_glucose ? `${h.blood_sugar.average_glucose} mg/dL` : "—"}</b>
                <span>Avg Glucose</span>
              </div>
              <div className="tile">
                <b>{h.blood_sugar?.total_tests || 0}</b>
                <span>Total Tests</span>
              </div>
            </div>
            <BloodSugarChart days={h.blood_sugar?.days || []} logs={h.blood_sugar?.logs || []} />
          </Card>

          {/* Medication Adherence */}
          <Card icon="💊" title="Medication Adherence">
            <div className="tiles">
              <div className="tile"><b>{h.medicine.summary.scheduled}</b><span>Scheduled</span></div>
              <div className="tile"><b>{h.medicine.summary.taken}</b><span>Taken</span></div>
              <div className="tile"><b>{h.medicine.summary.skipped}</b><span>Skipped</span></div>
              <div className="tile"><b>{h.medicine.summary.pending + h.medicine.summary.snoozed}</b><span>Not recorded</span></div>
            </div>
            {trend && <MedicineChart days={h.medicine.days} />}
          </Card>

          {/* Water Intake */}
          <Card icon="💧" title="Daily Water Consumption">
            <div className="tiles">
              <div className="tile"><b>{fmtMl(h.water.total_ml)}</b><span>Total Intake</span></div>
              <div className="tile"><b>{fmtMl(h.water.average_ml)}</b><span>Daily Average</span></div>
            </div>
            {trend && <WaterChart days={h.water.days} target={settings?.water_target_ml} />}
          </Card>

          {/* Walking Activity */}
          <Card icon="🚶" title="Walking Activity & Progress">
            <div className="tiles">
              <div className="tile"><b>{Math.round(h.walking.total_minutes)} min</b><span>Total Time</span></div>
              <div className="tile"><b>{h.walking.total_km} km</b><span>Total Distance</span></div>
              <div className="tile"><b>{h.walking.average_minutes} min</b><span>Daily Average</span></div>
            </div>
            {trend && <WalkingChart days={h.walking.days} />}
          </Card>

          {/* Respirometer */}
          <Card icon="🫁" title="Breathing Routine (Respirometer)">
            <div className="tiles">
              <div className="tile"><b>{h.respirometer.summary.completed}</b><span>Completed</span></div>
              <div className="tile"><b>{h.respirometer.summary.scheduled}</b><span>Scheduled</span></div>
              <div className="tile"><b>{h.respirometer.summary.skipped}</b><span>Skipped</span></div>
            </div>
            {trend && <RespirometerChart days={h.respirometer.days} />}
          </Card>

          <p className="small muted center">
            Interactive analytical charts powered by Chart.js · Data updates dynamically as activities are logged.
          </p>
        </>
      )}
    </>
  );
}
