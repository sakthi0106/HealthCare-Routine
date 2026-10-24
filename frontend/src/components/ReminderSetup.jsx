import { useCallback, useEffect, useState } from "react";
import { askPermission } from "../services/notifications";
import { enablePush, pushSupported, sendTestPush } from "../services/push";
import { useToast } from "../hooks/useToast";

// Shows whether background reminders are on, and lets the user switch them on or send a test.
export default function ReminderSetup() {
  const toast = useToast();
  const [state, setState] = useState({ status: "checking", reason: "" });

  const activate = useCallback(async () => {
    const r = await enablePush();
    setState(r.ok ? { status: "on", reason: "" } : { status: "error", reason: r.reason });
  }, []);

  useEffect(() => {
    if (!pushSupported()) return setState({ status: "unsupported", reason: "" });
    if (Notification.permission === "denied") return setState({ status: "blocked", reason: "" });
    if (Notification.permission === "granted") activate(); // quietly re-register this phone every time the app opens
    else setState({ status: "off", reason: "" });
    return undefined;
  }, [activate]);

  const turnOn = async () => {
    const permission = await askPermission();
    if (permission === "granted") await activate();
    else setState({ status: permission === "denied" ? "blocked" : "off", reason: "" });
  };

  const test = async () => {
    try {
      await sendTestPush();
      toast("Test sent. A notification should pop up in a few seconds.");
    } catch (e) {
      toast(e.message, "error");
    }
  };

  if (state.status === "checking") return null;

  if (state.status === "on") {
    return (
      <div className="alert alert-info banner">
        <p>🔔 Reminders are on for this phone.</p>
        <button className="btn btn-small btn-outline" onClick={test}>Send test</button>
      </div>
    );
  }

  if (state.status === "unsupported") {
    return (
      <div className="alert alert-warn">
        <p>This browser cannot show reminders when the app is closed. Please open the website in Chrome on Android and install it.</p>
      </div>
    );
  }

  if (state.status === "blocked") {
    return (
      <div className="alert alert-warn">
        <p><strong>Notifications are blocked.</strong> Long-press the app icon → App info → Notifications → turn on. Or in Chrome: ⋮ → Settings → Site settings → Notifications → allow this site. Then reopen the app.</p>
      </div>
    );
  }

  return (
    <div className="alert alert-info">
      <p>{state.status === "error" ? `Reminders are not working yet: ${state.reason}` : "Turn on reminders so this phone tells you when it is time for medicine, even when the app is closed."}</p>
      <button className="btn btn-small" style={{ marginTop: ".5rem" }} onClick={state.status === "error" ? activate : turnOn}>
        {state.status === "error" ? "Try again" : "Turn on reminders"}
      </button>
    </div>
  );
}
