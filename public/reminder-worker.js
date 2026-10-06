// Displays page-requested reminders and, where a browser supports it, handles its
// best-effort Periodic Background Sync. Browser cadence is not under app control.
const DB_NAME = "the-system-reminders";
const STORE_NAME = "state";
const STATE_KEY = "current";
const REMINDER_TAG = "the-system-daily-reminder";
const SIX_HOURS = 6 * 60 * 60 * 1000;

self.addEventListener("install", () => { self.skipWaiting(); });
self.addEventListener("activate", (event) => { event.waitUntil(self.clients.claim()); });

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readState() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(STATE_KEY);
    request.onsuccess = () => { db.close(); resolve(request.result || null); };
    request.onerror = () => { db.close(); reject(request.error); };
  });
}

async function writeState(state) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(state, STATE_KEY);
    transaction.oncomplete = () => { db.close(); resolve(); };
    transaction.onerror = () => { db.close(); reject(transaction.error); };
  });
}

self.addEventListener("message", (event) => {
  if (event.data?.type === "reminder-state" && event.data.state) {
    event.waitUntil(writeState(event.data.state));
  }
});

// Periodic Background Sync is best effort: installed-PWA/Chromium support only,
// browser-scheduled timing, and not a substitute for server push.
self.addEventListener("periodicsync", (event) => {
  if (event.tag !== REMINDER_TAG) return;
  event.waitUntil((async () => {
    const state = await readState();
    const now = Date.now();
    if (!state?.enabled || !state.name || state.dailyCompleted || state.dead || state.inLockdown || state.penalty) return;
    if (!Number.isFinite(state.lastReminderCheck) || now - state.lastReminderCheck < SIX_HOURS) return;

    const remaining = Math.max(1, Math.floor((state.deadlineAt - now) / 60000));
    const hours = Math.floor(remaining / 60);
    const timeLeft = hours ? `${hours}h ${remaining % 60}m` : `${remaining}m`;
    try {
      await self.registration.showNotification("The System / Daily Quest", {
        body: `${timeLeft} left today. Your Daily Quest is still incomplete. Small sets count; train at a safe pace.`,
        tag: "system-daily-reminder",
        icon: "/system-icon.svg",
      });
      state.lastReminderCheck = now;
      await writeState(state);
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      clients.forEach((client) => client.postMessage({ type: "reminder-delivered", lastReminderCheck: now }));
    } catch {
      // Permission may have been revoked while the app was closed; don't spin.
    }
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const app = windows.find((client) => new URL(client.url).origin === self.location.origin);
    if (app) return app.focus();
    return self.clients.openWindow("/");
  })());
});