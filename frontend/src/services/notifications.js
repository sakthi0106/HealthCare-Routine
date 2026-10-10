// Shows phone/browser notifications. Each notification id is shown only once.
const SEEN_KEY = "fhc_seen_notifications";

const loadSeen = () => {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) || "[]");
  } catch {
    return [];
  }
};

export const notificationsSupported = () => "Notification" in window;
export const permission = () => (notificationsSupported() ? Notification.permission : "unsupported");

export async function askPermission() {
  if (!notificationsSupported()) return "unsupported";
  return Notification.requestPermission();
}

export async function showOnce(list) {
  const seen = loadSeen();
  const fresh = list.filter((n) => !seen.includes(n.id));
  if (!fresh.length) return;
  localStorage.setItem(SEEN_KEY, JSON.stringify([...seen, ...fresh.map((n) => n.id)].slice(-300)));
  if (permission() !== "granted") return;

  for (const n of fresh) {
    const options = { body: n.message, tag: n.id, icon: "/icons/icon-192.png", badge: "/icons/icon-192.png", vibrate: [200, 100, 200] };
    try {
      const reg = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration() : null;
      if (reg) await reg.showNotification(n.title, options);
      else new Notification(n.title, options);
    } catch {
      /* some browsers block the constructor; the in-app banner still shows */
    }
  }
}
