/**
 * charts.jsx – Interactive charts using Chart.js (replacing Plotly).
 * Supported:
 * - TodayProgressChart (Routine progress)
 * - MedicineChart (Stacked bars of doses)
 * - WaterChart (Water volume with daily target line)
 * - WalkingChart (Duration & distance)
 * - RespirometerChart (Breathing sessions)
 * - BloodSugarChart (Glucose measurements & trends with target range)
 * - OverallHealthChart (Multi-metric healthcare adherence)
 * - StockChart (Admin inventory status)
 */
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, LineElement, PointElement,
  ArcElement, Tooltip, Legend, Filler,
} from "chart.js";
import { Bar, Line, Doughnut } from "react-chartjs-2";
import { fmtMl } from "../utils/format";

ChartJS.register(
  CategoryScale, LinearScale, BarElement, LineElement, PointElement,
  ArcElement, Tooltip, Legend, Filler,
);

// ── Design tokens ────────────────────────────────────────────────────────────
export const C = {
  ok:         "#16a37a",
  okFade:     "rgba(22,163,122,0.18)",
  warn:       "#f0a020",
  warnFade:   "rgba(240,160,32,0.18)",
  muted:      "#9aa7b8",
  mutedFade:  "rgba(154,167,184,0.18)",
  blue:       "#4f8df0",
  blueFade:   "rgba(79,141,240,0.18)",
  danger:     "#e5484d",
  dangerFade: "rgba(229,72,77,0.18)",
  purple:     "#8b5cf6",
  purpleFade: "rgba(139,92,246,0.18)",
  teal:       "#0d9488",
  tealFade:   "rgba(13,148,136,0.18)",
};

const BASE_OPTS = {
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 500 },
  plugins: {
    legend: { position: "bottom", labels: { boxWidth: 14, padding: 14, font: { size: 12 } } },
    tooltip: { mode: "index", intersect: false, padding: 10, cornerRadius: 8 },
  },
  scales: {
    x: { grid: { display: false }, ticks: { maxRotation: 0 } },
    y: { grid: { color: "rgba(0,0,0,0.05)" }, beginAtZero: true },
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const pct = (v, t) => (t > 0 ? Math.min(100, Math.round((v * 100) / t)) : 0);

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

// ── Today's Progress – Horizontal Progress Bars ───────────────────────────────
export function TodayProgressChart({ medicines, water, walking, respirometer }) {
  const rows = [
    { label: "Medicines",   pct: pct(medicines.taken, medicines.total),            detail: `${medicines.taken} of ${medicines.total} doses`,               color: C.ok },
    { label: "Water",       pct: pct(water.ml, water.target),                      detail: `${fmtMl(water.ml)} of ${fmtMl(water.target || 0)}`,            color: C.blue },
    { label: "Walking",     pct: pct(walking.minutes, walking.target),             detail: `${Math.round(walking.minutes)} of ${walking.target ?? 0} min`,   color: C.warn },
    { label: "Breathing",   pct: pct(respirometer.completed, respirometer.total), detail: `${respirometer.completed} of ${respirometer.total} sessions`, color: C.purple },
  ];

  return (
    <div className="today-progress-chart">
      {rows.map((r) => (
        <div key={r.label} className="progress-row">
          <div className="progress-row-header">
            <span className="progress-row-label">{r.label}</span>
            <span className="progress-row-detail">{r.detail} — <strong>{r.pct}%</strong></span>
          </div>
          <div className="progress-track">
            <div className="progress-track-fill" style={{ width: `${r.pct}%`, background: r.color }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Medicine Chart – Stacked Bar ──────────────────────────────────────────────
export function MedicineChart({ days }) {
  const labels = days.map((d) => formatDate(d.date));
  const data = {
    labels,
    datasets: [
      { label: "Taken",        data: days.map((d) => d.taken),   backgroundColor: C.ok,    borderRadius: 4 },
      { label: "Skipped",      data: days.map((d) => d.skipped), backgroundColor: C.warn,  borderRadius: 4 },
      { label: "Not recorded", data: days.map((d) => Math.max(0, d.scheduled - d.taken - d.skipped)), backgroundColor: C.muted, borderRadius: 4 },
    ],
  };
  const opts = {
    ...BASE_OPTS,
    scales: {
      ...BASE_OPTS.scales,
      x: { ...BASE_OPTS.scales.x, stacked: true },
      y: { ...BASE_OPTS.scales.y, stacked: true, ticks: { stepSize: 1 } },
    },
  };
  return <div style={{ height: 300 }}><Bar data={data} options={opts} /></div>;
}

// ── Water Chart – Bar + Line target ──────────────────────────────────────────
export function WaterChart({ days, target }) {
  const labels = days.map((d) => formatDate(d.date));
  const datasets = [
    { label: "Water (L)", data: days.map((d) => +(d.total_ml / 1000).toFixed(2)), backgroundColor: C.blueFade, borderColor: C.blue, borderWidth: 2, borderRadius: 4, fill: true },
  ];
  if (target) {
    datasets.push({
      label: "Daily target",
      data: days.map(() => +(target / 1000).toFixed(2)),
      type: "line",
      borderColor: C.warn,
      borderDash: [6, 3],
      borderWidth: 2,
      pointRadius: 0,
      fill: false,
    });
  }
  const opts = {
    ...BASE_OPTS,
    scales: { ...BASE_OPTS.scales, y: { ...BASE_OPTS.scales.y, title: { display: true, text: "Litres" } } },
  };
  return <div style={{ height: 300 }}><Bar data={{ labels, datasets }} options={opts} /></div>;
}

// ── Walking Chart – Bar (minutes) + Line (km) ─────────────────────────────────
export function WalkingChart({ days }) {
  const labels = days.map((d) => formatDate(d.date));
  const data = {
    labels,
    datasets: [
      { label: "Minutes",    data: days.map((d) => Math.round(d.minutes)), backgroundColor: C.warnFade, borderColor: C.warn, borderWidth: 2, borderRadius: 4, fill: true },
      { label: "Kilometres", data: days.map((d) => d.km), type: "line", borderColor: C.ok, borderWidth: 2.5, pointRadius: 3, fill: false, yAxisID: "y2" },
    ],
  };
  const opts = {
    ...BASE_OPTS,
    scales: {
      ...BASE_OPTS.scales,
      y:  { ...BASE_OPTS.scales.y, title: { display: true, text: "Minutes" }, position: "left" },
      y2: { beginAtZero: true, position: "right", grid: { display: false }, title: { display: true, text: "km" } },
    },
  };
  return <div style={{ height: 300 }}><Bar data={data} options={opts} /></div>;
}

// ── Respirometer Chart – Bar + Line ──────────────────────────────────────────
export function RespirometerChart({ days }) {
  const labels = days.map((d) => formatDate(d.date));
  const data = {
    labels,
    datasets: [
      { label: "Completed",  data: days.map((d) => d.completed),  backgroundColor: C.okFade,   borderColor: C.ok,    borderWidth: 2, borderRadius: 4, fill: true },
      { label: "Scheduled",  data: days.map((d) => d.scheduled),  type: "line", borderColor: C.muted, borderDash: [5, 3], borderWidth: 2, pointRadius: 2, fill: false },
    ],
  };
  const opts = { ...BASE_OPTS, scales: { ...BASE_OPTS.scales, y: { ...BASE_OPTS.scales.y, ticks: { stepSize: 1 } } } };
  return <div style={{ height: 300 }}><Bar data={data} options={opts} /></div>;
}

// ── Blood Sugar Chart – FBS / PPBS Trends & Full Report ──────────────────────
const FBS_CONTEXTS  = ["Fasting"];
const PPBS_CONTEXTS = ["Post Lunch (2 hrs)", "Post Dinner (2 hrs)", "Post Breakfast (2 hrs)"];

function isFBS(ctx)  { return FBS_CONTEXTS.some((c) => ctx?.toLowerCase().includes(c.toLowerCase()) || ctx === "FBS"); }
function isPPBS(ctx) { return PPBS_CONTEXTS.some((c) => ctx?.toLowerCase().includes(c.toLowerCase()) || ctx === "PPBS"); }

function sugarBadge(ctx, level) {
  const v = Number(level);
  if (isFBS(ctx)) {
    if (v < 70)   return { cls: "badge-danger", text: "Low" };
    if (v <= 99)  return { cls: "badge-ok",     text: "Normal" };
    if (v <= 125) return { cls: "badge-warn",   text: "Pre-diabetic" };
    return          { cls: "badge-danger",       text: "High" };
  }
  if (isPPBS(ctx)) {
    if (v < 140)  return { cls: "badge-ok",   text: "Normal" };
    if (v < 200)  return { cls: "badge-warn", text: "Elevated" };
    return          { cls: "badge-danger",    text: "High" };
  }
  // generic
  if (v < 70)  return { cls: "badge-danger", text: "Low" };
  if (v <= 140)return { cls: "badge-ok",     text: "Normal" };
  return         { cls: "badge-warn",         text: "High" };
}

export function BloodSugarChart({ days = [], logs = [] }) {
  const labels   = days.map((d) => formatDate(d.date));

  // Separate FBS and PPBS per day
  const fbsData  = days.map((d) => {
    const vals = (d.readings || []).filter((r) => isFBS(r.meal_context)).map((r) => Number(r.glucose_level)).filter(Boolean);
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  });
  const ppbsData = days.map((d) => {
    const vals = (d.readings || []).filter((r) => isPPBS(r.meal_context)).map((r) => Number(r.glucose_level)).filter(Boolean);
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  });
  const avgData  = days.map((d) => d.average || null);

  const hasFBS  = fbsData.some(Boolean);
  const hasPPBS = ppbsData.some(Boolean);

  const datasets = [];

  if (hasFBS) {
    datasets.push({
      label: "FBS – Fasting (mg/dL)",
      data: fbsData,
      type: "line",
      borderColor: "#f97316",
      backgroundColor: "rgba(249,115,22,0.12)",
      borderWidth: 2.5,
      pointRadius: 5,
      pointHoverRadius: 7,
      pointBackgroundColor: "#f97316",
      fill: false,
      spanGaps: true,
    });
  }
  if (hasPPBS) {
    datasets.push({
      label: "PPBS – Post Meal (mg/dL)",
      data: ppbsData,
      type: "line",
      borderColor: "#8b5cf6",
      backgroundColor: "rgba(139,92,246,0.12)",
      borderWidth: 2.5,
      pointRadius: 5,
      pointHoverRadius: 7,
      pointBackgroundColor: "#8b5cf6",
      fill: false,
      spanGaps: true,
    });
  }
  if (!hasFBS && !hasPPBS && avgData.some(Boolean)) {
    datasets.push({
      label: "Daily Avg Glucose (mg/dL)",
      data: avgData,
      type: "line",
      borderColor: C.teal,
      backgroundColor: C.tealFade,
      borderWidth: 2.5,
      pointRadius: 4,
      pointHoverRadius: 6,
      fill: true,
      spanGaps: true,
    });
  }

  // Reference lines
  datasets.push({
    label: "FBS Normal Max (99)",
    data: days.map(() => 99),
    type: "line",
    borderColor: "rgba(249,115,22,0.35)",
    borderDash: [4, 4],
    borderWidth: 1.5,
    pointRadius: 0,
    fill: false,
  });
  datasets.push({
    label: "PPBS Normal Max (140)",
    data: days.map(() => 140),
    type: "line",
    borderColor: "rgba(139,92,246,0.35)",
    borderDash: [4, 4],
    borderWidth: 1.5,
    pointRadius: 0,
    fill: false,
  });

  const opts = {
    ...BASE_OPTS,
    scales: {
      ...BASE_OPTS.scales,
      y: {
        ...BASE_OPTS.scales.y,
        min: 40,
        suggestedMax: 220,
        title: { display: true, text: "mg/dL" },
      },
    },
    plugins: {
      ...BASE_OPTS.plugins,
      legend: { display: true, position: "top", labels: { boxWidth: 14, font: { size: 11 } } },
    },
  };

  // Sort logs newest first for the table
  const sortedLogs = [...logs].sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));

  return (
    <div>
      <div style={{ height: 300 }}><Line data={{ labels, datasets }} options={opts} /></div>

      {/* ── FBS / PPBS Summary Tiles ── */}
      {logs.length > 0 && (() => {
        const fbsLogs  = logs.filter((l) => isFBS(l.meal_context));
        const ppbsLogs = logs.filter((l) => isPPBS(l.meal_context));
        const avg = (arr) => arr.length ? Math.round(arr.reduce((s, l) => s + Number(l.glucose_level), 0) / arr.length) : null;
        const latest = (arr) => arr.sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time))[0];
        const fbsAvg  = avg(fbsLogs);
        const ppbsAvg = avg(ppbsLogs);
        const latestFBS  = latest([...fbsLogs]);
        const latestPPBS = latest([...ppbsLogs]);
        return (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: ".6rem", margin: ".9rem 0 .3rem" }}>
            <div className="sugar-summary-tile fbs-tile">
              <div className="sugar-tile-label">🟠 FBS (Fasting)</div>
              <div className="sugar-tile-value">{latestFBS ? `${latestFBS.glucose_level} mg/dL` : "—"}</div>
              <div className="sugar-tile-sub">Latest · Avg: {fbsAvg ?? "—"} mg/dL · {fbsLogs.length} reading{fbsLogs.length !== 1 ? "s" : ""}</div>
              {latestFBS && (() => { const s = sugarBadge(latestFBS.meal_context, latestFBS.glucose_level); return <span className={`badge ${s.cls}`}>{s.text}</span>; })()}
            </div>
            <div className="sugar-summary-tile ppbs-tile">
              <div className="sugar-tile-label">🟣 PPBS (Post Meal)</div>
              <div className="sugar-tile-value">{latestPPBS ? `${latestPPBS.glucose_level} mg/dL` : "—"}</div>
              <div className="sugar-tile-sub">Latest · Avg: {ppbsAvg ?? "—"} mg/dL · {ppbsLogs.length} reading{ppbsLogs.length !== 1 ? "s" : ""}</div>
              {latestPPBS && (() => { const s = sugarBadge(latestPPBS.meal_context, latestPPBS.glucose_level); return <span className={`badge ${s.cls}`}>{s.text}</span>; })()}
            </div>
          </div>
        );
      })()}

      {/* ── Full Readings Report Table ── */}
      {sortedLogs.length > 0 && (
        <div style={{ marginTop: ".8rem" }}>
          <p className="small muted" style={{ fontWeight: 700, marginBottom: ".4rem" }}>
            All Blood Sugar Readings ({sortedLogs.length} total):
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Type</th>
                  <th>Level</th>
                  <th>Status</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {sortedLogs.map((l, i) => {
                  const isFbs  = isFBS(l.meal_context);
                  const isPpbs = isPPBS(l.meal_context);
                  const badge  = sugarBadge(l.meal_context, l.glucose_level);
                  return (
                    <tr key={l.log_id || i}>
                      <td>{l.date}</td>
                      <td>{l.time}</td>
                      <td>
                        <span className={`badge ${isFbs ? "badge-fbs" : isPpbs ? "badge-ppbs" : "badge-muted"}`}>
                          {isFbs ? "FBS" : isPpbs ? "PPBS" : l.meal_context || "—"}
                        </span>
                      </td>
                      <td style={{ fontWeight: 700 }}>{l.glucose_level} mg/dL</td>
                      <td><span className={`badge ${badge.cls}`}>{badge.text}</span></td>
                      <td className="small muted">{l.notes && l.notes !== "FBS" && l.notes !== "PPBS" ? l.notes : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Overall Healthcare Activity Chart ─────────────────────────────────────────
export function OverallHealthChart({ medicineSummary, waterSummary, walkingSummary, respSummary }) {
  const medPct = medicineSummary?.scheduled ? Math.round((medicineSummary.taken * 100) / medicineSummary.scheduled) : 0;
  const waterPct = waterSummary?.target ? Math.min(100, Math.round((waterSummary.total_ml * 100) / waterSummary.target)) : 0;
  const walkPct = walkingSummary?.target ? Math.min(100, Math.round((walkingSummary.total_minutes * 100) / walkingSummary.target)) : 0;
  const respPct = respSummary?.scheduled ? Math.round((respSummary.completed * 100) / respSummary.scheduled) : 0;

  const data = {
    labels: ["Medication Adherence", "Water Goal", "Walking Activity", "Breathing Routine"],
    datasets: [
      {
        label: "Completion Rate (%)",
        data: [medPct, waterPct, walkPct, respPct],
        backgroundColor: [C.ok, C.blue, C.warn, C.purple],
        borderRadius: 8,
      },
    ],
  };

  const opts = {
    ...BASE_OPTS,
    indexAxis: "y",
    plugins: {
      ...BASE_OPTS.plugins,
      legend: { display: false },
    },
    scales: {
      x: { ...BASE_OPTS.scales.x, max: 100, title: { display: true, text: "% Completed" } },
      y: { grid: { display: false } },
    },
  };

  const overallAvg = Math.round((medPct + waterPct + walkPct + respPct) / 4);

  return (
    <div>
      <div style={{ textAlign: "center", marginBottom: ".8rem" }}>
        <p className="small muted">Composite Health Adherence Index</p>
        <span className="big" style={{ color: overallAvg >= 75 ? C.ok : overallAvg >= 50 ? C.warn : C.danger }}>
          {overallAvg}%
        </span>
      </div>
      <div style={{ height: 220 }}><Bar data={data} options={opts} /></div>
    </div>
  );
}

// ── Stock Chart – Horizontal Bar ─────────────────────────────────────────────
export function StockChart({ items }) {
  const colourMap = { ok: C.ok, low: C.warn, out: C.danger };
  const labels = items.map((i) => i.medicine_name);
  const data = {
    labels,
    datasets: [
      {
        label: "Tablets left",
        data: items.map((i) => i.current_stock),
        backgroundColor: items.map((i) => colourMap[i.state] || C.muted),
        borderRadius: 4,
      },
    ],
  };
  const opts = {
    ...BASE_OPTS,
    indexAxis: "y",
    plugins: { ...BASE_OPTS.plugins, legend: { display: false } },
    scales: {
      x: { ...BASE_OPTS.scales.x, beginAtZero: true, title: { display: true, text: "Tablets" } },
      y: { grid: { display: false } },
    },
  };
  const h = Math.max(220, items.length * 44 + 60);
  return <div style={{ height: h }}><Bar data={data} options={opts} /></div>;
}
