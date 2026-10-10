import { useCallback, useEffect, useState } from "react";
import { api } from "../services/api";
import { showOnce } from "../services/notifications";

const DISMISSED_KEY = "fhc_dismissed_banners";

// Checks the backend once a minute for reminders that are due.
export default function useReminders() {
  const [due, setDue] = useState([]);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem(DISMISSED_KEY) || "[]");
    } catch {
      return [];
    }
  });

  const check = useCallback(async () => {
    try {
      const { notifications } = await api("/api/notifications/due");
      setDue(notifications);
      showOnce(notifications);
    } catch {
      /* reminders are best-effort; never interrupt the user with an error */
    }
  }, []);

  useEffect(() => {
    check();
    const t = setInterval(check, 60000);
    const onVisible = () => document.visibilityState === "visible" && check();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [check]);

  const dismiss = (id) => {
    const next = [...dismissed, id];
    setDismissed(next);
    sessionStorage.setItem(DISMISSED_KEY, JSON.stringify(next));
  };

  return { banners: due.filter((n) => !dismissed.includes(n.id)), dismiss, refresh: check };
}
