import useFetch from "../hooks/useFetch";
import { Card, ErrorBox, Loading, ProgressBar, StatusBadge } from "../components/ui";
import { SessionActions } from "../components/DoseActions";
import { fmtTime } from "../utils/format";

export default function Respirometer() {
  const { data, error, reload } = useFetch("/api/respirometer/today", { interval: 60000 });
  if (!data) return error ? <ErrorBox message={error} onRetry={reload} /> : <Loading />;

  const freq = data.settings.frequency_minutes;
  const every = freq % 60 === 0 ? `${freq / 60} hour${freq === 60 ? "" : "s"}` : `${freq} minutes`;

  return (
    <>
      <h1>🫁 Respirometer</h1>
      <Card icon="🫁" title="Today">
        {data.total === 0 ? (
          <p className="muted">No sessions are scheduled. The family can set them in Settings.</p>
        ) : (
          <>
            <p className="big">{data.completed} / {data.total} <small>sessions</small></p>
            <ProgressBar value={data.completed} max={data.total} label="Respirometer progress" />
            {data.next && <p>Next session: <strong>{fmtTime(data.next.scheduled_time)}</strong></p>}
            <p className="small muted">{fmtTime(data.settings.start)} to {fmtTime(data.settings.end)}{freq ? `, every ${every}` : ""}</p>
          </>
        )}
      </Card>
      {data.items.map((s) => (
        <Card key={s.log_id} icon="⏱️" title={fmtTime(s.scheduled_time)}>
          <div className="row" style={{ border: 0, padding: 0 }}>
            <StatusBadge state={s.state} />
            {s.completed_time && <span className="muted">Done at {fmtTime(s.completed_time)}</span>}
          </div>
          {["due", "snoozed", "upcoming"].includes(s.state) && <SessionActions session={s} onDone={reload} />}
        </Card>
      ))}
    </>
  );
}
