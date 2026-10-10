import { useState } from "react";
import { api } from "../services/api";
import { useToast } from "../hooks/useToast";

// Buttons for one medicine dose. The dose amount itself can never be changed here.
export function DoseActions({ dose, onDone }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const act = async (action, okMessage, confirmText) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    try {
      await api(`/api/medicines/${dose.medicine_id}/${action}`, { method: "POST", body: { log_id: dose.log_id } });
      toast(okMessage);
      onDone();
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="btn-row">
      <button className="btn btn-ok" disabled={busy} onClick={() => act("taken", "Marked as taken ✓")}>✓ Taken</button>
      <button className="btn" disabled={busy} onClick={() => act("snooze", "We will remind you again soon")}>Snooze</button>
      <button className="btn btn-outline" disabled={busy} onClick={() => act("skip", "Marked as skipped", `Skip ${dose.medicine_name}?`)}>Skip</button>
    </div>
  );
}

export function SessionActions({ session, onDone }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const act = async (action, okMessage, confirmText) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    try {
      await api(`/api/respirometer/${session.log_id}/${action}`, { method: "POST", body: {} });
      toast(okMessage);
      onDone();
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="btn-row">
      <button className="btn btn-ok" disabled={busy} onClick={() => act("complete", "Session recorded ✓")}>✓ Completed</button>
      <button className="btn" disabled={busy} onClick={() => act("snooze", "We will remind you again soon")}>Snooze</button>
      <button className="btn btn-outline" disabled={busy} onClick={() => act("skip", "Marked as skipped", "Skip this respirometer session?")}>Skip</button>
    </div>
  );
}
