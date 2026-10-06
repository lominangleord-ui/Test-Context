import { getMsUntilMidnight } from "./utils";

export const REMINDER_INTERVAL_MS = 6 * 60 * 60 * 1000;
export const REMINDER_POLL_MS = 15 * 60 * 1000;
export const REMINDER_SYNC_TAG = "the-system-daily-reminder";

export function isReminderDue(state: {
  name: string;
  lastReminderCheck: number;
  dailyCompleted: boolean;
  dead: boolean;
  inLockdown: boolean;
  penalty: boolean;
}, now = Date.now()) {
  return !!state.name && !state.dailyCompleted && !state.dead && !state.inLockdown && !state.penalty
    && Number.isFinite(state.lastReminderCheck) && now - state.lastReminderCheck >= REMINDER_INTERVAL_MS;
}

export function reminderBody(now = Date.now()) {
  const minutes = Math.max(1, Math.floor(getMsUntilMidnight(now) / 60000));
  const hours = Math.floor(minutes / 60);
  const remaining = hours ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
  return `${remaining} left today. Your Daily Quest is still incomplete. Small sets count; train at a safe pace.`;
}