import LiveChart from "./LiveChart";
import { fmtMl } from "../utils/format";

// Ready-made interactive charts, shared by the dashboard, the father's pages and the reports.
export const C = { ok: "#16a37a", warn: "#f0a020", muted: "#9aa7b8", blue: "#4f8df0", danger: "#e5484d" };

const pct = (value, target) => (target > 0 ? Math.min(100, Math.round((value * 100) / target)) : 0);
const dateAxis = (n) => ({ type: "date", tickformat: "%d %b", dtick: n <= 10 ? 86400000 : undefined });

// Today at a glance: how far along each routine is. Props use plain numbers, so it works with any data source.
export function TodayProgressChart({ medicines, water, walking, respirometer }) {
  const rows = [
    ["Medicines", pct(medicines.taken, medicines.total), `${medicines.taken} of ${medicines.total} doses`, C.ok],
    ["Water", pct(water.ml, water.target), `${fmtMl(water.ml)} of ${fmtMl(water.target || 0)}`, C.blue],
    ["Walking", pct(walking.minutes, walking.target), `${Math.round(walking.minutes)} of ${walking.target ?? 0} min`, C.warn],
    ["Breathing", pct(respirometer.completed, respirometer.total), `${respirometer.completed} of ${respirometer.total} sessions`, C.ok],
  ].reverse(); // Plotly draws horizontal bars bottom-up
  return (
    <LiveChart
      height={230}
      data={[{
        type: "bar", orientation: "h", x: rows.map((r) => r[1]), y: rows.map((r) => r[0]),
        text: rows.map((r) => `${r[1]}%`), textposition: "auto", marker: { color: rows.map((r) => r[3]) },
        customdata: rows.map((r) => r[2]), hovertemplate: "%{y}: %{customdata}<extra></extra>",
      }]}
      layout={{ xaxis: { range: [0, 100], ticksuffix: "%" }, margin: { l: 90, r: 18, t: 8, b: 36 }, showlegend: false }}
    />
  );
}

export function MedicineChart({ days }) {
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

export function WaterChart({ days, target }) {
  const x = days.map((d) => d.date);
  const data = [
    { type: "bar", name: "Water (litres)", x, y: days.map((d) => d.total_ml / 1000), marker: { color: C.blue }, hovertemplate: "%{x|%d %b}<br>%{y:.2f} L<extra></extra>" },
  ];
  if (target) data.push({ type: "scatter", mode: "lines", name: "Daily target", x, y: x.map(() => target / 1000), line: { color: C.warn, dash: "dash", width: 2 }, hovertemplate: "Target: %{y:.1f} L<extra></extra>" });
  return <LiveChart data={data} layout={{ xaxis: dateAxis(days.length), yaxis: { title: "Litres", rangemode: "tozero" } }} />;
}

export function WalkingChart({ days }) {
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

export function RespirometerChart({ days }) {
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

// Medicine stock: tablets left per medicine, coloured by state, with a marker at the reorder level.
export function StockChart({ items }) {
  const rows = [...items].reverse();
  const colour = { ok: C.ok, low: C.warn, out: C.danger };
  return (
    <LiveChart
      height={Math.max(220, rows.length * 46 + 90)}
      data={[
        { type: "bar", orientation: "h", name: "Tablets left", x: rows.map((r) => r.current_stock), y: rows.map((r) => r.medicine_name),
          marker: { color: rows.map((r) => colour[r.state]) }, hovertemplate: "%{y}: %{x} tablets left<extra></extra>" },
        { type: "scatter", mode: "markers", name: "Reorder level", x: rows.map((r) => r.reorder_level), y: rows.map((r) => r.medicine_name),
          marker: { symbol: "diamond", size: 12, color: "#2d3436", line: { color: "#fff", width: 1 } }, hovertemplate: "%{y}: reorder at %{x}<extra></extra>" },
      ]}
      layout={{ xaxis: { rangemode: "tozero", title: "Tablets" }, margin: { l: 130, r: 18, t: 8, b: 56 } }}
    />
  );
}
