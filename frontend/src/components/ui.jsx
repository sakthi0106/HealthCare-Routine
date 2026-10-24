// Small reusable pieces: Card, ProgressBar, Modal, StatusBadge, Loading/Error, Field, BarChart, Disclaimer.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

export function Card({ icon, title, to, children, tone }) {
  return (
    <section className={`card ${tone ? "card-" + tone : ""}`}>
      <h2 className="card-title">
        {to ? (
          <Link to={to}>
            <span aria-hidden="true">{icon}</span> {title} <span className="chev" aria-hidden="true">›</span>
          </Link>
        ) : (
          <>
            <span aria-hidden="true">{icon}</span> {title}
          </>
        )}
      </h2>
      {children}
    </section>
  );
}

export function ProgressBar({ value, max, label }) {
  const pct = max > 0 ? Math.min(100, Math.round((value * 100) / max)) : 0;
  return (
    <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className="progress-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Modal({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="btn btn-ghost btn-small" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

const STATES = {
  taken: ["✓ Taken", "ok"], completed: ["✓ Done", "ok"], skipped: ["Skipped", "muted"],
  due: ["⏰ Due now", "warn"], upcoming: ["⏳ Upcoming", "info"], snoozed: ["😴 Snoozed", "info"],
  missed: ["Not recorded", "muted"],
};
export function StatusBadge({ state }) {
  const [label, tone] = STATES[state] || [state, "muted"];
  return <span className={`badge badge-${tone}`}>{label}</span>;
}

export const Loading = ({ text = "Loading…" }) => <p className="center muted" role="status">{text}</p>;

export function ErrorBox({ message, onRetry }) {
  return (
    <div className="alert alert-danger" role="alert">
      <p>{message}</p>
      {onRetry && <button className="btn btn-small" onClick={onRetry}>Try again</button>}
    </div>
  );
}

export function Field({ label, hint, children }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="hint">{hint}</span>}
    </label>
  );
}

export function Check({ label, checked, onChange }) {
  return (
    <label className="check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

// Simple bar chart made of plain HTML (no chart library needed).
export function BarChart({ data, unit = "", color = "var(--primary)", format = (v) => v }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const step = Math.ceil(data.length / 8);
  return (
    <div className="chart" role="img" aria-label="Bar chart">
      {data.map((d, i) => (
        <div className="bar-col" key={d.label + i} title={`${d.label}: ${format(d.value)}${unit}`}>
          <span className="bar-value">{d.value ? format(d.value) : ""}</span>
          <div className="bar" style={{ height: `${(d.value / max) * 100}%`, background: color }} />
          <span className="bar-label">{i % step === 0 || data.length <= 8 ? d.label : ""}</span>
        </div>
      ))}
    </div>
  );
}

export const Disclaimer = ({ compact }) => (
  <p className={compact ? "disclaimer small" : "disclaimer"}>
    This app is for routine tracking and reminders only. It is not a replacement for professional medical advice.
    Always follow your doctor's instructions.
  </p>
);

// 12-hour time picker with an explicit AM/PM box (the phone's own time box often defaults to AM).
// `value` and `onChange` use 24-hour "HH:MM" text (or "" when empty), which is what the backend stores.
const HOURS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);

export function TimeField({ label, hint, value, onChange, defaultPeriod = "AM" }) {
  const [pref, setPref] = useState(defaultPeriod);
  const m = /^(\d{2}):(\d{2})$/.exec(value || "");
  const hour12 = m ? String(Number(m[1]) % 12 || 12) : "";
  const minute = m ? Number(m[2]) : 0;
  const period = m ? (Number(m[1]) >= 12 ? "PM" : "AM") : pref;
  const minuteOptions = MINUTES.includes(minute) ? MINUTES : [...MINUTES, minute].sort((a, b) => a - b);

  const emit = (h12, min, per) => {
    if (!h12) return onChange("");
    const h = (Number(h12) % 12) + (per === "PM" ? 12 : 0);
    onChange(`${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`);
  };

  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <div className="time12">
        <select aria-label={`${label} hour`} value={hour12} onChange={(e) => emit(e.target.value, minute, period)}>
          <option value="">--</option>
          {HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
        </select>
        <span aria-hidden="true">:</span>
        <select aria-label={`${label} minute`} value={minute} disabled={!hour12} onChange={(e) => emit(hour12, Number(e.target.value), period)}>
          {minuteOptions.map((n) => <option key={n} value={n}>{String(n).padStart(2, "0")}</option>)}
        </select>
        <select aria-label={`${label} AM or PM`} value={period} onChange={(e) => { setPref(e.target.value); emit(hour12, minute, e.target.value); }}>
          <option>AM</option>
          <option>PM</option>
        </select>
      </div>
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}
