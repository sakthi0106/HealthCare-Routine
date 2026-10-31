import { useEffect, useState } from "react";
import useFetch from "../../hooks/useFetch";
import { Card, ErrorBox, Loading } from "../../components/ui";
import { MedicineChart, RespirometerChart, TodayProgressChart, WalkingChart, WaterChart } from "../../components/charts";
import { fmtDate, fmtMl } from "../../utils/format";

const VIEWS = [["today", "Daily"], ["week", "Weekly"], ["last30", "Monthly"]];
const LIVE_MS = 15000; // how often the graphs refresh while "Live" is on

export default function Reports() {
  const [view, setView] = useState("today");
  const [live, setLive] = useState(true);
  const [updatedAt, setUpdatedAt] = useState(null);
  const { data: h, error, reload } = useFetch(`/api/history?range=${view}`, { interval: live ? LIVE_MS : 0 });
  const settings = useFetch("/api/settings", { interval: live ? 60000 : 0 }).data;

  useEffect(() => { if (h) setUpdatedAt(new Date()); }, [h]);
  useEffect(() => {   // refresh straight away when the family member comes back to this screen
    const onVisible = () => document.visibilityState === "visible" && live && reload();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  });

  const trend = view !== "today";

  return (
    <>
      <h1>Reports</h1>
      <div className="tabs">
        {VIEWS.map(([k, label]) => <button key={k} className={`tab ${view === k ? "active" : ""}`} onClick={() => setView(k)}>{label}</button>)}
      </div>
      <div className="live-row">
        <button className="btn btn-small btn-outline live-pill" onClick={() => setLive(!live)} aria-pressed={live}>
          <span className={`live-dot ${live ? "" : "off"}`} aria-hidden="true" />
          {live ? "Live: on" : "Live: paused"}
        </button>
        <span className="small muted" role="status">
          {updatedAt ? `Updated ${updatedAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : "Loading…"}
          {live ? " · refreshes every 15 seconds" : ""}
        </span>
        {!live && <button className="btn btn-small btn-outline" onClick={reload}>Refresh now</button>}
      </div>

      {error && <ErrorBox message={error} onRetry={reload} />}
      {!h && !error && <Loading />}
      {h && (
        <>
          <p className="muted">{h.start === h.end ? fmtDate(h.start) : `${fmtDate(h.start)} – ${fmtDate(h.end)}`}</p>

          {!trend && (
            <Card icon="🎯" title="Today's progress">
              <TodayProgressChart
                medicines={{ taken: h.medicine.summary.taken, total: h.medicine.summary.scheduled }}
                water={{ ml: h.water.total_ml, target: settings?.water_target_ml }}
                walking={{ minutes: h.walking.total_minutes, target: settings?.walking_target_minutes }}
                respirometer={{ completed: h.respirometer.summary.completed, total: h.respirometer.summary.scheduled }}
              />
            </Card>
          )}

          <Card icon="💊" title="Medicines">
            <div className="tiles">
              <div className="tile"><b>{h.medicine.summary.scheduled}</b><span>Scheduled</span></div>
              <div className="tile"><b>{h.medicine.summary.taken}</b><span>Taken</span></div>
              <div className="tile"><b>{h.medicine.summary.skipped}</b><span>Skipped</span></div>
              <div className="tile"><b>{h.medicine.summary.pending + h.medicine.summary.snoozed}</b><span>Not recorded</span></div>
            </div>
            {trend && <MedicineChart days={h.medicine.days} />}
          </Card>

          <Card icon="💧" title="Water">
            <div className="tiles">
              <div className="tile"><b>{fmtMl(h.water.total_ml)}</b><span>Total</span></div>
              <div className="tile"><b>{fmtMl(h.water.average_ml)}</b><span>Daily average</span></div>
            </div>
            {trend && <WaterChart days={h.water.days} target={settings?.water_target_ml} />}
          </Card>

          <Card icon="🚶" title="Walking">
            <div className="tiles">
              <div className="tile"><b>{Math.round(h.walking.total_minutes)} min</b><span>Total time</span></div>
              <div className="tile"><b>{h.walking.total_km} km</b><span>Total distance</span></div>
              <div className="tile"><b>{h.walking.average_minutes} min</b><span>Daily average</span></div>
            </div>
            {trend && <WalkingChart days={h.walking.days} />}
          </Card>

          <Card icon="🫁" title="Respirometer">
            <div className="tiles">
              <div className="tile"><b>{h.respirometer.summary.completed}</b><span>Completed</span></div>
              <div className="tile"><b>{h.respirometer.summary.scheduled}</b><span>Scheduled</span></div>
              <div className="tile"><b>{h.respirometer.summary.skipped}</b><span>Skipped</span></div>
            </div>
            {trend && <RespirometerChart days={h.respirometer.days} />}
          </Card>
          <p className="small muted center">Hover or tap a bar for details · drag to zoom · double-click to reset · click a legend name to hide it. These are records of what was marked in the app, not a health score or medical advice. Days the app was not opened count as "not recorded".</p>
        </>
      )}
    </>
  );
}
