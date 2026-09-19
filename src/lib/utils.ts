import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Every user-facing time in this app is Swedish wall-clock time in the store's
 * zone. Formatting is pinned here rather than left to the device locale: a
 * Zebra set to en-US must still show `19:45`, never `7:45 PM`, because the
 * checklists themselves are written in 24-hour time.
 */
export const STORE_LOCALE = 'sv-SE';
export const STORE_TIME_ZONE = 'Europe/Stockholm';

const dateFmt = new Intl.DateTimeFormat(STORE_LOCALE, {
  timeZone: STORE_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const timeFmt = new Intl.DateTimeFormat(STORE_LOCALE, {
  timeZone: STORE_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const dateTimeFmt = new Intl.DateTimeFormat(STORE_LOCALE, {
  timeZone: STORE_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export const formatDate = (d: Date | string) => dateFmt.format(new Date(d));
export const formatTime = (d: Date | string) => timeFmt.format(new Date(d));
export const formatDateTime = (d: Date | string) => dateTimeFmt.format(new Date(d));

/**
 * Remaining time until a deadline, as the worker UI shows it: `-` once late, so
 * an overdue item reads `-12 min` rather than a confusing negative countdown.
 */
export function formatRemaining(target: Date | string, now: Date = new Date()): string {
  const diffMs = new Date(target).getTime() - now.getTime();
  const late = diffMs < 0;
  const totalMin = Math.floor(Math.abs(diffMs) / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  const body = h > 0 ? `${h} h ${m} min` : `${m} min`;
  return late ? `-${body}` : body;
}
