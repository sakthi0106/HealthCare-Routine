import { useCallback, useEffect, useState } from "react";
import { api } from "../services/api";

// Loads data from the backend. `reload()` refreshes quietly (keeps old data on screen meanwhile).
export default function useFetch(path, { interval = 0, enabled = true } = {}) {
  const [state, setState] = useState({ data: null, loading: true, error: "" });

  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) setState((s) => ({ ...s, loading: true, error: "" }));
      try {
        const data = await api(path);
        setState({ data, loading: false, error: "" });
      } catch (e) {
        setState((s) => ({ ...s, loading: false, error: e.message }));
      }
    },
    [path]
  );

  useEffect(() => {
    if (!enabled) return undefined;
    load();
    if (!interval) return undefined;
    const t = setInterval(() => load(true), interval);
    return () => clearInterval(t);
  }, [load, interval, enabled]);

  return { ...state, reload: () => load(true) };
}
