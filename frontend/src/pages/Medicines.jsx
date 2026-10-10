import { useState } from "react";
import useFetch from "../hooks/useFetch";
import { Card, ErrorBox, Field, Loading, StatusBadge } from "../components/ui";
import { DoseActions } from "../components/DoseActions";
import { SLOT_ICON, cap, fmtShortDate, fmtTime, todayISO } from "../utils/format";

const RANGES = [["today", "Today"], ["week", "This Week"], ["month", "This Month"], ["custom", "Custom"]];

export default function Medicines() {
  const today = useFetch("/api/medicines/today");
  const [range, setRange] = useState("today");
  const [start, setStart] = useState(todayISO());
  const [end, setEnd] = useState(todayISO());
  const ready = range !== "custom" || (start && end);
  const url = `/api/history?range=${range}&parts=medicine${range === "custom" ? `&start=${start}&end=${end}` : ""}`;
  const hist = useFetch(url, { enabled: !!ready });

  const refresh = () => { today.reload(); hist.reload(); };
  const doses = today.data?.items || [];

  return (
    <>
      <h1>💊 Medicines</h1>
      {today.error && <ErrorBox message={today.error} onRetry={today.reload} />}
      {today.loading && !today.data && <Loading />}

      <Card icon="📅" title="Today">
        {today.data && <p className="big">{today.data.taken} of {today.data.total} <small>completed</small></p>}
        {today.data && doses.length === 0 && <p className="muted">No medicines are scheduled today.</p>}
        {doses.map((d) => (
          <div className="row" key={d.log_id} style={{ display: "block" }}>
            <div className="row" style={{ border: 0, padding: 0 }}>
              <div>
                <strong>{d.medicine_name}</strong>
                <div className="muted">{SLOT_ICON[d.slot]} {cap(d.slot)} · {fmtTime(d.scheduled_time)}{d.dosage ? ` · ${d.dosage}` : ""}</div>
                {d.taken_time && <div className="muted">Taken at {fmtTime(d.taken_time)}</div>}
              </div>
              <StatusBadge state={d.state} />
            </div>
            {(d.state === "due" || d.state === "snoozed" || d.state === "upcoming") && <DoseActions dose={d} onDone={refresh} />}
          </div>
        ))}
      </Card>

      <Card icon="📜" title="Medicine Log">
        <div className="tabs">
          {RANGES.map(([k, label]) => (
            <button key={k} className={`tab ${range === k ? "active" : ""}`} onClick={() => setRange(k)}>{label}</button>
          ))}
        </div>
        {range === "custom" && (
          <div className="grid2">
            <Field label="From"><input type="date" value={start} max={todayISO()} onChange={(e) => setStart(e.target.value)} /></Field>
            <Field label="To"><input type="date" value={end} max={todayISO()} onChange={(e) => setEnd(e.target.value)} /></Field>
          </div>
        )}
        {hist.error && <ErrorBox message={hist.error} onRetry={hist.reload} />}
        {hist.loading && !hist.data && <Loading />}
        {hist.data && (
          <>
            <div className="tiles">
              <div className="tile"><b>{hist.data.medicine.summary.scheduled}</b><span>Scheduled</span></div>
              <div className="tile"><b>{hist.data.medicine.summary.taken}</b><span>Taken</span></div>
              <div className="tile"><b>{hist.data.medicine.summary.skipped}</b><span>Skipped</span></div>
            </div>
            <p className="small muted">A record of what was marked in the app. It is not a medical assessment.</p>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Date</th><th>Medicine</th><th>Scheduled</th><th>Status</th><th>Taken</th></tr></thead>
                <tbody>
                  {hist.data.medicine.logs.map((l, i) => (
                    <tr key={l.log_id || i}>
                      <td>{fmtShortDate(l.date)}</td><td>{l.medicine_name}</td><td>{fmtTime(l.scheduled_time)}</td>
                      <td>{l.recorded ? l.status : "Pending"}</td><td>{fmtTime(l.taken_time) || "—"}</td>
                    </tr>
                  ))}
                  {hist.data.medicine.logs.length === 0 && <tr><td colSpan={5} className="muted">No records for this period.</td></tr>}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>
    </>
  );
}
