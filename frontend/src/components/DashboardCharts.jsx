import { useState } from "react";
import useFetch from "../hooks/useFetch";
import { Card, ErrorBox } from "./ui";
import Icon from "./Icon";
import LazyWhenVisible from "./LazyWhenVisible";
import { MedicineChart, RespirometerChart, StockChart, TodayProgressChart, WalkingChart, WaterChart } from "./charts";

const TABS = [["medicine", "pill", "Pills"], ["water", "droplet", "Water"], ["walking", "footprints", "Walk"], ["breathing", "wind", "Breathe"]];
const RANGES = [["last7", "7 days"], ["last30", "30 days"]];

// The interactive dashboard shown on Home for both the father and the family.
// `today` is the data Home already loaded, so "Today's progress" updates whenever Home refreshes.
export default function DashboardCharts({ today, isAdmin }) {
  const [metric, setMetric] = useState("medicine");
  const [range, setRange] = useState("last7");
  const hist = useFetch(`/api/history?range=${range}`, { interval: 60000 });
  const settings = useFetch("/api/settings").data;
  const inventory = useFetch("/api/inventory", { enabled: isAdmin, interval: 60000 });
  const tabs = isAdmin ? [...TABS, ["stock", "package", "Stock"]] : TABS;
  const h = hist.data;

  let chart = <p className="center muted">Loading chart…</p>;
  if (metric === "stock") chart = <StockChart items={inventory.data?.items || []} />;
  else if (h && metric === "medicine") chart = <MedicineChart days={h.medicine.days} />;
  else if (h && metric === "water") chart = <WaterChart days={h.water.days} target={settings?.water_target_ml} />;
  else if (h && metric === "walking") chart = <WalkingChart days={h.walking.days} />;
  else if (h && metric === "breathing") chart = <RespirometerChart days={h.respirometer.days} />;

  return (
    <Card icon="📊" title="Dashboard">
      <h3 className="dash-heading">Today's progress</h3>
      <LazyWhenVisible minHeight={230}>
        <TodayProgressChart
          medicines={{ taken: today.medicines.taken, total: today.medicines.total }}
          water={{ ml: today.water.total_ml, target: today.water.target_ml }}
          walking={{ minutes: today.walking.total_minutes, target: today.walking.target_minutes }}
          respirometer={{ completed: today.respirometer.completed, total: today.respirometer.total }}
        />
      </LazyWhenVisible>

      <h3 className="dash-heading">Look back</h3>
      <div className="tabs" role="tablist" aria-label="Choose a graph">
        {tabs.map(([key, icon, label]) => (
          <button key={key} role="tab" aria-selected={metric === key} className={`tab ${metric === key ? "active" : ""}`} onClick={() => setMetric(key)}>
            <Icon name={icon} size={20} /> {label}
          </button>
        ))}
      </div>
      {metric !== "stock" && (
        <div className="tabs" role="tablist" aria-label="Choose how far back">
          {RANGES.map(([key, label]) => (
            <button key={key} role="tab" aria-selected={range === key} className={`tab ${range === key ? "active" : ""}`} onClick={() => setRange(key)}>{label}</button>
          ))}
        </div>
      )}
      {hist.error && metric !== "stock" && <ErrorBox message={hist.error} onRetry={hist.reload} />}
      <LazyWhenVisible minHeight={300}>{chart}</LazyWhenVisible>
      <p className="small muted center">Tap a bar or point for details. The graphs update by themselves.</p>
    </Card>
  );
}
