import { useEffect, useState } from "react";
import useFetch from "../../hooks/useFetch";
import { Card, ErrorBox, Loading } from "../../components/ui";
import LiveChart from "../../components/LiveChart";
import { fmtDate, fmtMl } from "../../utils/format";

const VIEWS = [["today", "Daily"], ["week", "Weekly"], ["last30", "Monthly"]];
const LIVE_MS = 15000; // how often the graphs refresh while "Live" is on
const C = { ok: "#16a37a", warn: "#f0a020", muted: "#9aa7b8", blue: "#4f8df0" };

const pct = (value, target) => (target > 0 ? Math.min(100, Math.round((value * 100) / target)) : 0);
const dateAxis = (n) => ({ type: "date", tickformat: "%d %b", dtick: n <= 10 ? 86400000 : undefined });

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
      <h1>📊 Reports</h1>
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

          {!trend && <TodayProgress h={h} settings={settings} />}

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

/* ---------------- charts ---------------- */
function TodayProgress({ h, settings }) {
  const med = h.medicine.summary, resp = h.respirometer.summary;
  const rows = [
    ["Medicines", pct(med.taken, med.scheduled), `${med.taken} of ${med.scheduled} doses`, C.ok],
    ["Water", pct(h.water.total_ml, settings?.water_target_ml), `${fmtMl(h.water.total_ml)} of ${fmtMl(settings?.water_target_ml || 0)}`, C.blue],
    ["Walking", pct(h.walking.total_minutes, settings?.walking_target_minutes), `${Math.round(h.walking.total_minutes)} of ${settings?.walking_target_minutes ?? 0} min`, C.warn],
    ["Respirometer", pct(resp.completed, resp.scheduled), `${resp.completed} of ${resp.scheduled} sessions`, C.ok],
  ].reverse(); // Plotly draws horizontal bars bottom-up
  return (
    <Card icon="🎯" title="Today's progress">
      <LiveChart
        height={230}
        data={[{
          type: "bar", orientation: "h", x: rows.map((r) => r[1]), y: rows.map((r) => r[0]),
          text: rows.map((r) => `${r[1]}%`), textposition: "auto", marker: { color: rows.map((r) => r[3]) },
          customdata: rows.map((r) => r[2]), hovertemplate: "%{y}: %{customdata}<extra></extra>",
        }]}
        layout={{ xaxis: { range: [0, 100], ticksuffix: "%" }, margin: { l: 100, r: 18, t: 8, b: 36 }, showlegend: false }}
      />
    </Card>
  );
}

function MedicineChart({ days }) {
  const x = days.map((d) => d.date);
  const max = Math.max(1, ...days.map((d) => d.scheduled));
  return (
    <LiveChart
      data={[
        { type: "bar", name: "Taken", x, y: days.map((d) => d.taken), marker: { color: C.ok }, hovertemplate: "%{x|%d %b}<br>Taken: %{y}<extra></extra>" },
        { type: "bar", name: "Skipped", x, y: days.map((d) => d.skipped), marker: { color: C.warn }, hovertemplate: "%{x|%d %b}<br>Skipped: %{y}<extra></extra>" },
        { type: "bar", name: "Not recorded", x, y: days.map((d) => Math.max(0, d.scheduled - d.taken - d.skipped)), marker: { color: C.muted }, hovertemplate: "%{x|%d %b}<br>Not recorded: %{y}<extra></extra>" },
      ]}
      layout={{ barmode: "stack", xaxis: dateAxis(days.length), yaxis: { title: "Doses", rangemode: "tozero", dtick: max <= 8 ? 1 : undefined } }}
    />
  );
}

function WaterChart({ days, target }) {
  const x = days.map((d) => d.date);
  const data = [
    { type: "bar", name: "Water (litres)", x, y: days.map((d) => d.total_ml / 1000), marker: { color: C.blue }, hovertemplate: "%{x|%d %b}<br>%{y:.2f} L<extra></extra>" },
  ];
  if (target) data.push({ type: "scatter", mode: "lines", name: "Daily target", x, y: x.map(() => target / 1000), line: { color: C.warn, dash: "dash", width: 2 }, hovertemplate: "Target: %{y:.1f} L<extra></extra>" });
  return <LiveChart data={data} layout={{ xaxis: dateAxis(days.length), yaxis: { title: "Litres", rangemode: "tozero" } }} />;
}

function WalkingChart({ days }) {
  const x = days.map((d) => d.date);
  return (
    <LiveChart
      data={[
        { type: "bar", name: "Minutes", x, y: days.map((d) => Math.round(d.minutes)), marker: { color: C.warn }, hovertemplate: "%{x|%d %b}<br>%{y} min<extra></extra>" },
        { type: "scatter", mode: "lines+markers", name: "Kilometres", x, y: days.map((d) => d.km), yaxis: "y2", line: { color: C.ok, width: 3 }, hovertemplate: "%{x|%d %b}<br>%{y} km<extra></extra>" },
      ]}
      layout={{
        xaxis: dateAxis(days.length), yaxis: { title: "Minutes", rangemode: "tozero" },
        yaxis2: { title: "km", overlaying: "y", side: "right", showgrid: false, rangemode: "tozero" }, margin: { l: 52, r: 52, t: 12, b: 56 },
      }}
    />
  );
}

function RespirometerChart({ days }) {
  const x = days.map((d) => d.date);
  const max = Math.max(1, ...days.map((d) => d.scheduled));
  return (
    <LiveChart
      data={[
        { type: "bar", name: "Completed", x, y: days.map((d) => d.completed), marker: { color: C.ok }, hovertemplate: "%{x|%d %b}<br>Completed: %{y}<extra></extra>" },
        { type: "scatter", mode: "lines+markers", name: "Scheduled", x, y: days.map((d) => d.scheduled), line: { color: C.muted, dash: "dot", width: 2 }, hovertemplate: "%{x|%d %b}<br>Scheduled: %{y}<extra></extra>" },
      ]}
      layout={{ xaxis: dateAxis(days.length), yaxis: { title: "Sessions", rangemode: "tozero", dtick: max <= 8 ? 1 : undefined } }}
    />
  );
}
