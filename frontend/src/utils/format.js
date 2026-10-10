// Small helpers for showing dates, times and amounts in simple language.
export const fmtTime = (hhmm) => {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
};

export const fmtDate = (iso, opts = { day: "numeric", month: "long", year: "numeric" }) =>
  iso ? new Date(iso + "T00:00:00").toLocaleDateString("en-IN", opts) : "";

export const fmtShortDate = (iso) => fmtDate(iso, { day: "numeric", month: "short" });

export const fmtMl = (ml) => (ml < 1000 ? `${ml} ml` : `${+(ml / 1000).toFixed(2)} L`);

export const todayISO = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

export const nowHHMM = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

export const SLOT_ICON = { morning: "🌅", afternoon: "☀️", evening: "🌇", night: "🌙" };
export const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : "");
