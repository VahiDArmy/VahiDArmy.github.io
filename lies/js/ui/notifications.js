/* ============================================================
   js/ui/notifications.js
   Browser Notification API wrapper + scheduled reminders
   ============================================================ */

import { get, set } from '../utils/storage.js';

const SCHEDULE_KEY = 'notifications:scheduled';

/**
 * @typedef {Object} ScheduledReminder
 * @property {string} id
 * @property {string} title
 * @property {string} [body]
 * @property {number} at  // timestamp (ms)
 * @property {string} [url]
 * @property {string} [icon]
 */

/* ── Support ─────────────────────────────────────────────── */

export function isSupported() {
  return typeof Notification !== 'undefined';
}

export function getPermission() {
  return isSupported() ? Notification.permission : 'unsupported';
}

export function isGranted() {
  return getPermission() === 'granted';
}

export function isDenied() {
  return getPermission() === 'denied';
}

/* ── Permission ──────────────────────────────────────────── */

/**
 * Request notification permission if not already asked.
 * @returns {Promise<'granted'|'denied'|'default'|'unsupported'>}
 */
export async function requestPermission() {
  if (!isSupported()) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  try {
    const result = await Notification.requestPermission();
    return result;
  } catch {
    return 'default';
  }
}

/* ── Show ────────────────────────────────────────────────── */

/**
 * Show a notification (no-op if not granted).
 * @param {string} title
 * @param {NotificationOptions & { url?:string }} [options]
 * @returns {Notification|null}
 */
export function notify(title, options = {}) {
  if (!isGranted()) return null;
  try {
    const { url, ...rest } = options;
    const data = { ...(options.data || {}), url };
    const n = new Notification(title, {
      icon: options.icon || './manifest.webmanifest',
      badge: options.badge || './manifest.webmanifest',
      dir: 'rtl',
      lang: 'fa-IR',
      ...rest,
      data,
    });
    n.onclick = () => {
      window.focus();
      if (url) location.hash = url;
      n.close();
    };
    return n;
  } catch (err) {
    console.warn('[notifications] failed', err);
    return null;
  }
}

/* ── Scheduled reminders ────────────────────────────────── */

/** @type {Map<string, number>} */
const timers = new Map();

function loadSchedule() {
  const list = get(SCHEDULE_KEY, []);
  return Array.isArray(list) ? list : [];
}

function saveSchedule(list) {
  set(SCHEDULE_KEY, list);
}

/**
 * Schedule a reminder.
 * @param {ScheduledReminder} reminder
 */
export function schedule(reminder) {
  const list = loadSchedule();
  const idx = list.findIndex((r) => r.id === reminder.id);
  if (idx >= 0) list[idx] = reminder;
  else list.push(reminder);
  saveSchedule(list);
  armTimer(reminder);
}

/**
 * Cancel a scheduled reminder.
 * @param {string} id
 */
export function cancel(id) {
  const list = loadSchedule().filter((r) => r.id !== id);
  saveSchedule(list);
  const t = timers.get(id);
  if (t) { clearTimeout(t); timers.delete(id); }
}

/**
 * List all pending reminders.
 * @returns {ScheduledReminder[]}
 */
export function listScheduled() {
  return loadSchedule().filter((r) => r.at > Date.now());
}

/**
 * Arm a timer for one reminder (fires when due).
 * @param {ScheduledReminder} reminder
 */
function armTimer(reminder) {
  const existing = timers.get(reminder.id);
  if (existing) clearTimeout(existing);

  const delay = reminder.at - Date.now();
  if (delay <= 0) {
    // Fire immediately
    notify(reminder.title, { body: reminder.body, url: reminder.url });
    cancel(reminder.id);
    return;
  }
  if (delay > 0x7fffffff) return; // too far in the future

  const t = setTimeout(() => {
    notify(reminder.title, { body: reminder.body, url: reminder.url });
    cancel(reminder.id);
  }, delay);
  timers.set(reminder.id, t);
}

/**
 * Re-arm all scheduled reminders (call on app boot).
 */
export function initScheduledReminders() {
  for (const r of listScheduled()) {
    if (r.at - Date.now() < 24 * 60 * 60 * 1000) {
      armTimer(r);
    }
  }
}

/**
 * Schedule a "review your lies" daily reminder at a given time.
 * @param {number} hour 0-23
 * @param {number} minute 0-59
 */
export function scheduleDailyReview(hour = 20, minute = 0) {
  const next = new Date();
  next.setHours(hour, minute, 0, 0);
  if (next.getTime() <= Date.now()) next.setDate(next.getDate() + 1);
  schedule({
    id: 'daily-review',
    title: 'وقت مرور دروغ‌های امروز 🎭',
    body: 'چند لحظه وقت بگذار و به دروغ‌هایی که امروز به خودت گفتی فکر کن.',
    at: next.getTime(),
    url: '#/lies',
  });
  // Reschedule for the next day after it fires
  setTimeout(() => scheduleDailyReview(hour, minute), next.getTime() - Date.now() + 60_000);
}

export default {
  isSupported, getPermission, isGranted, isDenied,
  requestPermission, notify,
  schedule, cancel, listScheduled, initScheduledReminders, scheduleDailyReview,
};