import { useState } from "react";
import useFetch from "../hooks/useFetch";
import { Card, ErrorBox, Field, Modal } from "./ui";
import Icon from "./Icon";
import LazyWhenVisible from "./LazyWhenVisible";
import {
  BloodSugarChart,
  MedicineChart,
  OverallHealthChart,
  RespirometerChart,
  StockChart,
  TodayProgressChart,
  WalkingChart,
  WaterChart,
} from "./charts";
import { api } from "../services/api";
import { useToast } from "../hooks/useToast";

const TABS = [
  ["medicine",  "pill",        "Pills"],
  ["water",     "droplet",     "Water"],
  ["walking",   "footprints",  "Walk"],
  ["breathing", "wind",        "Breathe"],
  ["sugar",     "activity",    "Blood Sugar"],
  ["overall",   "bar-chart",   "Overall"],
];

const RANGES = [
  ["today",  "Daily"],
  ["last7",  "7 Days"],
  ["last30", "Monthly"],
];

export default function DashboardCharts({ today, isAdmin }) {
  const toast = useToast();
  const [metric, setMetric] = useState("medicine");
  const [range,  setRange]  = useState("last7");
  const [logSugarOpen, setLogSugarOpen] = useState(false);
  const [sugarForm, setSugarForm] = useState({ glucose_level: "", meal_context: "Fasting", notes: "" });
  const [sugarBusy, setSugarBusy] = useState(false);

  const hist      = useFetch(`/api/history?range=${range}`, { interval: 60000 });
  const settings  = useFetch("/api/settings").data;
  const inventory = useFetch("/api/inventory", { enabled: isAdmin, interval: 60000 });
  const tabs      = isAdmin ? [...TABS, ["stock", "package", "Stock"]] : TABS;
  const h         = hist.data;

  const saveSugar = async () => {
    if (!sugarForm.glucose_level) return;
    setSugarBusy(true);
    try {
      await api("/api/blood-sugar", {
        method: "POST",
        body: {
          glucose_level: parseInt(sugarForm.glucose_level, 10),
          meal_context: sugarForm.meal_context,
          notes: sugarForm.notes,
        },
      });
      toast("Blood sugar recorded ✓");
      setLogSugarOpen(false);
      setSugarForm({ glucose_level: "", meal_context: "Fasting", notes: "" });
      hist.reload();
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setSugarBusy(false);
    }
  };

  let chart = <p className="center muted">Loading chart…</p>;
  if (metric === "stock")     chart = <StockChart items={inventory.data?.items || []} />;
  else if (h) {
    if (metric === "medicine") chart = <MedicineChart  days={h.medicine.days} />;
    if (metric === "water")    chart = <WaterChart     days={h.water.days}    target={settings?.water_target_ml} />;
    if (metric === "walking")  chart = <WalkingChart   days={h.walking.days} />;
    if (metric === "breathing")chart = <RespirometerChart days={h.respirometer.days} />;
    if (metric === "sugar")    chart = <BloodSugarChart days={h.blood_sugar?.days || []} logs={h.blood_sugar?.logs || []} />;
    if (metric === "overall")  chart = (
      <OverallHealthChart
        medicineSummary={h.medicine?.summary}
        waterSummary={{ total_ml: h.water?.total_ml, target: (settings?.water_target_ml || 2500) * (h.days_in_range || 1) }}
        walkingSummary={{ total_minutes: h.walking?.total_minutes, target: (settings?.walking_target_minutes || 30) * (h.days_in_range || 1) }}
        respSummary={h.respirometer?.summary}
      />
    );
  }

  return (
    <Card icon="📊" title="Interactive Healthcare Analytics">
      {/* Today's progress */}
      <h3 className="dash-heading">Today's Routine Progress</h3>
      <LazyWhenVisible minHeight={180}>
        <TodayProgressChart
          medicines={{ taken: today.medicines.taken, total: today.medicines.total }}
          water={{ ml: today.water.total_ml, target: today.water.target_ml }}
          walking={{ minutes: today.walking.total_minutes, target: today.walking.target_minutes }}
          respirometer={{ completed: today.respirometer.completed, total: today.respirometer.total }}
        />
      </LazyWhenVisible>

      {/* Trends header with Log Blood Sugar action */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1.2rem", flexWrap: "wrap", gap: ".5rem" }}>
        <h3 className="dash-heading" style={{ margin: 0 }}>Trend Analysis</h3>
        {metric === "sugar" && (
          <button className="btn btn-small btn-outline" onClick={() => setLogSugarOpen(true)}>
            + Log Reading
          </button>
        )}
      </div>

      {/* Metric tabs */}
      <div className="tabs" role="tablist" aria-label="Choose a metric" style={{ marginTop: ".5rem" }}>
        {tabs.map(([key, icon, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={metric === key}
            className={`tab ${metric === key ? "active" : ""}`}
            onClick={() => setMetric(key)}
          >
            <Icon name={icon} size={17} /> {label}
          </button>
        ))}
      </div>

      {/* Date range tabs */}
      {metric !== "stock" && (
        <div className="tabs" role="tablist" aria-label="Date range">
          {RANGES.map(([key, label]) => (
            <button
              key={key}
              role="tab"
              aria-selected={range === key}
              className={`tab ${range === key ? "active" : ""}`}
              onClick={() => setRange(key)}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {hist.error && metric !== "stock" && <ErrorBox message={hist.error} onRetry={hist.reload} />}

      <LazyWhenVisible minHeight={280}>{chart}</LazyWhenVisible>

      <p className="small muted center" style={{ marginTop: ".6rem" }}>
        Live interactive charts · updates automatically when records are saved
      </p>

      {/* Log Blood Sugar Modal */}
      {logSugarOpen && (
        <Modal title="Log Blood Sugar" onClose={() => setLogSugarOpen(false)}>
          <Field label="Glucose Level (mg/dL) *">
            <input
              type="number"
              inputMode="numeric"
              min="30"
              max="600"
              placeholder="e.g. 110"
              value={sugarForm.glucose_level}
              onChange={(e) => setSugarForm({ ...sugarForm, glucose_level: e.target.value })}
              autoFocus
            />
          </Field>
          <Field label="Context / Timing">
            <select
              value={sugarForm.meal_context}
              onChange={(e) => setSugarForm({ ...sugarForm, meal_context: e.target.value })}
            >
              <option value="Fasting">Fasting (Before Breakfast)</option>
              <option value="Before Lunch">Before Lunch</option>
              <option value="Post Lunch (2 hrs)">Post Lunch (2 hrs)</option>
              <option value="Before Dinner">Before Dinner</option>
              <option value="Post Dinner (2 hrs)">Post Dinner (2 hrs)</option>
              <option value="Bedtime">Bedtime</option>
              <option value="Random">Random Check</option>
            </select>
          </Field>
          <Field label="Notes">
            <input
              type="text"
              placeholder="e.g. After morning walk"
              value={sugarForm.notes}
              onChange={(e) => setSugarForm({ ...sugarForm, notes: e.target.value })}
            />
          </Field>
          <button
            className="btn btn-block"
            disabled={sugarBusy || !sugarForm.glucose_level}
            onClick={saveSugar}
          >
            {sugarBusy ? "Saving…" : "Save Reading"}
          </button>
        </Modal>
      )}
    </Card>
  );
}
