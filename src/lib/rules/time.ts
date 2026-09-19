import type { Weekday } from './schema';

/**
 * Wall-clock ↔ instant conversion for a named IANA zone.
 *
 * The checklists are written in Swedish wall-clock time ("senast kl 19:45").
 * Turning that into an instant needs the zone's offset *at that moment*, which
 * changes twice a year — so this never does naive arithmetic like "add two
 * hours". It asks Intl what the offset actually is.
 *
 * The persisted `due_at` on a run item is resolved once, at run creation, and
 * then frozen. This module is what resolves it, and it must give the same
 * answer on the server and in the browser, because the engine runs in both.
 */

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatterCache.set(timeZone, formatter);
  }
  return formatter;
}

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function partsInZone(instant: Date, timeZone: string): ZonedParts {
  const parts = formatterFor(timeZone).formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes): number => {
    const found = parts.find((p) => p.type === type);
    return found ? Number(found.value) : 0;
  };
  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    // Some implementations render midnight as hour 24.
    hour: read('hour') % 24,
    minute: read('minute'),
    second: read('second'),
  };
}

/** Milliseconds the zone is ahead of UTC at the given instant. */
export function zoneOffsetMs(instant: Date, timeZone: string): number {
  const p = partsInZone(instant, timeZone);
  const asIfUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asIfUtc - instant.getTime();
}

/**
 * Converts a local date + time in `timeZone` to the instant it refers to.
 *
 * Two passes, because the offset depends on the answer: guess with the offset
 * at the naive timestamp, then re-check at the candidate. That second pass is
 * what makes the DST transitions come out right.
 */
export function zonedToInstant(
  isoDate: string,
  time: string,
  timeZone: string,
  dayOffset = 0,
): Date {
  const [y, m, d] = isoDate.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  if (y === undefined || m === undefined || d === undefined) {
    throw new Error(`Invalid business date: "${isoDate}"`);
  }
  if (hh === undefined || mm === undefined) {
    throw new Error(`Invalid time: "${time}"`);
  }

  const naive = Date.UTC(y, m - 1, d + dayOffset, hh, mm, 0);
  const firstGuess = new Date(naive - zoneOffsetMs(new Date(naive), timeZone));
  const refinedOffset = zoneOffsetMs(firstGuess, timeZone);
  return new Date(naive - refinedOffset);
}

const WEEKDAY_BY_INDEX: readonly Weekday[] = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

/** The weekday of a business date, as the store experiences it. */
export function weekdayOf(isoDate: string, timeZone: string): Weekday {
  // Noon avoids any chance of a DST shift moving the date across midnight.
  const instant = zonedToInstant(isoDate, '12:00', timeZone);
  const p = partsInZone(instant, timeZone);
  const index = new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay();
  return WEEKDAY_BY_INDEX[index] ?? 'MON';
}

export function isWeekend(isoDate: string, timeZone: string): boolean {
  const day = weekdayOf(isoDate, timeZone);
  return day === 'SAT' || day === 'SUN';
}

/** Today's business date in the store's zone, as YYYY-MM-DD. */
export function businessDateOf(instant: Date, timeZone: string): string {
  const p = partsInZone(instant, timeZone);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

export function addMinutes(instant: Date, minutes: number): Date {
  return new Date(instant.getTime() + minutes * 60_000);
}
