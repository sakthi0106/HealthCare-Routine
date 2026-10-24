// Background reminders: subscribes this phone to Web Push so reminders arrive even when the app is closed.
// If the phone is offline when a reminder is sent, it is delivered as soon as the phone is online again.
import { api } from "./api";

export const pushSupported = () =>
  "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

const toUint8 = (base64Url) => {
  const pad = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const raw = atob((base64Url + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

async function registration() {
  const existing = await navigator.serviceWorker.getRegistration();
  if (existing) return existing.active ? existing : navigator.serviceWorker.ready;
  // The service worker is only registered in the deployed (production) site.
  return Promise.race([navigator.serviceWorker.ready, new Promise((r) => setTimeout(() => r(null), 5000))]);
}

// Returns { ok: true } or { ok: false, reason: "plain-language explanation" }
export async function enablePush() {
  try {
    if (!pushSupported()) return { ok: false, reason: "This browser cannot receive background reminders. Please use Chrome on Android." };
    if (Notification.permission !== "granted") return { ok: false, reason: "Notifications are not allowed yet." };
    const reg = await registration();
    if (!reg) return { ok: false, reason: "The app is not ready for background reminders here. Use the deployed website, not the development version." };

    let publicKey;
    try {
      ({ publicKey } = await api("/api/push/public-key"));
    } catch (e) {
      return { ok: false, reason: e.message };
    }

        const wanted = toUint8(publicKey);
    let sub = await reg.pushManager.getSubscription();
    if (sub) {
      // If the server's key changed, the old registration is useless, so remove it and register again.
      const current = sub.options && sub.options.applicationServerKey ? new Uint8Array(sub.options.applicationServerKey) : null;
      const same = current && current.length === wanted.length && current.every((b, i) => b === wanted[i]);
      if (!same) {
        await sub.unsubscribe();
        sub = null;
      }
    }
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: wanted });
    await api("/api/push/subscribe", { method: "POST", body: sub.toJSON() });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e?.message || "Could not turn on background reminders." };
  }
}

export async function sendTestPush() {
  const reg = await registration();
  const sub = reg && (await reg.pushManager.getSubscription());
  if (!sub) throw new Error("This phone is not registered for reminders yet.");
  await api("/api/push/test", { method: "POST", body: { endpoint: sub.endpoint } });
}
