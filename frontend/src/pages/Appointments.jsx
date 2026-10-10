import useFetch from "../hooks/useFetch";
import { Card, ErrorBox, Loading } from "../components/ui";
import { fmtDate, fmtTime } from "../utils/format";

export function AppointmentCard({ a, children }) {
  return (
    <Card icon="🏥" title={a.purpose || a.department || "Appointment"}>
      <p className="big" style={{ fontSize: "1.2rem" }}>{fmtDate(a.date)}<br />{fmtTime(a.time)}</p>
      {a.doctor && <div className="row"><span>Doctor</span><strong>{a.doctor}</strong></div>}
      {a.hospital && <div className="row"><span>Hospital</span><strong>{a.hospital}</strong></div>}
      {a.department && <div className="row"><span>Department</span><strong>{a.department}</strong></div>}
      {a.purpose && <div className="row"><span>Purpose</span><strong>{a.purpose}</strong></div>}
      {a.notes && <p className="muted" style={{ marginTop: ".5rem" }}>{a.notes}</p>}
      {children}
    </Card>
  );
}

export default function Appointments() {
  const { data, error, reload } = useFetch("/api/appointments?upcoming=true");
  return (
    <>
      <h1>🏥 Appointments</h1>
      {error && <ErrorBox message={error} onRetry={reload} />}
      {!data && !error && <Loading />}
      {data && data.appointments.length === 0 && <p className="muted center">No upcoming appointments.</p>}
      {data && data.appointments.map((a) => <AppointmentCard key={a.appointment_id} a={a} />)}
    </>
  );
}
