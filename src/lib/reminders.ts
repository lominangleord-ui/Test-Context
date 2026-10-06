import { useGame } from "../store/game";
import { getMsUntilMidnight } from "./utils";
import { isReminderDue, reminderBody, REMINDER_INTERVAL_MS, REMINDER_SYNC_TAG } from "./reminderPolicy";

let registrationPromise: Promise<ServiceWorkerRegistration> | null = null;
const REMINDER_DB = "the-system-reminders";
const REMINDER_STORE = "state";
const REMINDER_KEY = "current";

interface ReminderSnapshot {
  enabled: boolean;
  name: string;
  dailyCompleted: boolean;
  dead: boolean;
  inLockdown: boolean;
  penalty: boolean;
  lastReminderCheck: number;
  deadlineAt: number;
}

function reminderSnapshot(): ReminderSnapshot {
  const state = useGame.getState();
  return {
    enabled: state.settings.remindersEnabled,
    name: state.name,
    dailyCompleted: state.dailyCompleted,
    dead: state.dead,
    inLockdown: state.inLockdown,
    penalty: state.penalty,
    lastReminderCheck: state.lastReminderCheck,
    deadlineAt: Date.now() + getMsUntilMidnight(),
  };
}

function openReminderDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) return reject(new Error("IndexedDB is unavailable."));
    const request = indexedDB.open(REMINDER_DB, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(REMINDER_STORE)) request.result.createObjectStore(REMINDER_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open reminder storage."));
  });
}

async function readBackgroundReminderState(): Promise<ReminderSnapshot | null> {
  let db: IDBDatabase;
  try { db = await openReminderDb(); } catch { return null; }
  return new Promise((resolve) => {
    const request = db.transaction(REMINDER_STORE, "readonly").objectStore(REMINDER_STORE).get(REMINDER_KEY);
    request.onsuccess = () => { db.close(); resolve((request.result as ReminderSnapshot | undefined) ?? null); };
    request.onerror = () => { db.close(); resolve(null); };
  });
}

export async function syncReminderSnapshot() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const registration = await reminderWorker();
    const worker = registration.active ?? registration.waiting ?? registration.installing;
    worker?.postMessage({ type: "reminder-state", state: reminderSnapshot() });
  } catch { /* foreground reminder path still works without a worker */ }
}

export async function reconcileReminderTimestamp() {
  const background = await readBackgroundReminderState();
  const current = useGame.getState();
  if (background && background.lastReminderCheck > current.lastReminderCheck) {
    useGame.setState({ lastReminderCheck: background.lastReminderCheck });
  }
}

async function registerPeriodicReminder(): Promise<"registered" | "unavailable" | "browser-managed"> {
  try {
    const registration = await reminderWorker();
    const periodic = registration as ServiceWorkerRegistration & {
      periodicSync?: { register: (tag: string, options: { minInterval: number }) => Promise<void> };
    };
    if (!periodic.periodicSync) return "unavailable";
    await periodic.periodicSync.register(REMINDER_SYNC_TAG, { minInterval: REMINDER_INTERVAL_MS });
    return "registered";
  } catch {
    return "browser-managed";
  }
}

export async function disableBackgroundReminders() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const registration = await reminderWorker();
    const periodic = registration as ServiceWorkerRegistration & {
      periodicSync?: { unregister: (tag: string) => Promise<boolean> };
    };
    await periodic.periodicSync?.unregister(REMINDER_SYNC_TAG);
    await syncReminderSnapshot();
  } catch { /* local reminders remain disabled in the app store */ }
}

export function notificationsSupported() {
  return typeof window !== "undefined" && window.isSecureContext && "Notification" in window;
}

async function reminderWorker() {
  if (!navigator.serviceWorker) throw new Error("Service workers are not supported.");
  if (!registrationPromise) {
    registrationPromise = (async () => {
      const registration = await navigator.serviceWorker.register("/reminder-worker.js", { scope: "/" });
      if (registration.active) return registration;
      let timer = 0;
      try {
        return await Promise.race([
          navigator.serviceWorker.ready,
          new Promise<never>((_, reject) => {
            timer = window.setTimeout(() => reject(new Error("Notification worker did not become ready.")), 8000);
          }),
        ]);
      } finally { clearTimeout(timer); }
    })();
    void registrationPromise.catch(() => { registrationPromise = null; });
  }
  return registrationPromise;
}

/** Display-only worker: no push subscription, remote scheduler or model caching. */
export async function showSystemNotification(title: string, body: string, stillRelevant?: () => boolean): Promise<boolean> {
  if (!notificationsSupported() || Notification.permission !== "granted") return false;
  const options: NotificationOptions = { body, tag: "system-daily-reminder", icon: "/system-icon.svg" };
  if ("serviceWorker" in navigator) {
    try {
      const registration = await reminderWorker();
      if (stillRelevant && !stillRelevant()) return false;
      await registration.showNotification(title, options);
      return true;
    } catch { /* Desktop constructor is a fallback; mobile failures stay in-app. */ }
  }
  try {
    if (stillRelevant && !stillRelevant()) return false;
    const notification = new Notification(title, options);
    notification.onclick = () => { window.focus(); notification.close(); };
    return true;
  } catch { return false; }
}

/** Call directly from the toggle's click handler, before any asynchronous work. */
export async function enableRemindersFromGesture() {
  if (!notificationsSupported()) {
    useGame.getState().notify({
      title: "In-App Reminders Available",
      message: "This browser cannot enable system notifications here. Reopen reminders still work. On iPhone or iPad, add the app to your Home Screen where supported.",
      type: "System",
    });
    return;
  }
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      useGame.getState().setRemindersEnabled(false);
      await disableBackgroundReminders();
      useGame.getState().notify({ title: "Reminders Not Enabled", message: "System notification permission was not granted. You will still get an in-app reminder when you return after six hours.", type: "System" });
      return;
    }
    useGame.getState().setRemindersEnabled(true);
    const background = await registerPeriodicReminder();
    await syncReminderSnapshot();
    useGame.getState().notify({
      title: background === "registered" ? "Background Reminder Requested" : "Open-Tab Reminders Enabled",
      message: background === "registered"
        ? "This installed browser accepted a best-effort background check. The browser chooses when it runs; six-hour delivery is not guaranteed."
        : "This browser cannot schedule reliable closed-app reminders. Notifications can appear while the app is open; reopening also checks for overdue reminders.",
      type: "System",
    });
  } catch {
    useGame.getState().notify({ title: "Permission Unavailable", message: "This browser could not request permission. Reopen reminders remain available without setup.", type: "System" });
  }
}

export async function checkDailyReminder(channel: "in-app" | "system", now = Date.now()) {
  const state = useGame.getState();
  if (state.screen !== "main" || !isReminderDue(state, now)) return;
  if (channel === "system" && !state.settings.remindersEnabled) return;

  await reconcileReminderTimestamp();
  const latest = useGame.getState();
  if (!isReminderDue(latest, now) || latest.screen !== "main") return;

  // Commit the timestamp before awaiting browser APIs to prevent duplicate checks.
  useGame.setState({ lastReminderCheck: now });
  void syncReminderSnapshot();
  const body = reminderBody(now);
  if (channel === "system" && await showSystemNotification("The System / Daily Quest", body, () => {
    const current = useGame.getState();
    return current.questDate === latest.questDate && !current.dailyCompleted && !current.dead && !current.inLockdown && !current.penalty;
  })) return;
  const current = useGame.getState();
  if (!current.dead && !current.inLockdown && !current.dailyCompleted) {
    current.notify({ title: "Daily Quest Reminder", message: body, type: "System" });
  }
}

export async function sendReminderTest() {
  const sent = await showSystemNotification("The System / Reminder Test", "Reminders are enabled. The open tab checks incomplete dailies every six hours. Nothing is scheduled after the app is closed.");
  if (!sent) useGame.getState().notify({ title: "Notification Test", message: "The browser could not display a system notification. Check site permission and operating-system settings. In-app reminders still work.", type: "System" });
  return sent;
}