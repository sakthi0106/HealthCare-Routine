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
