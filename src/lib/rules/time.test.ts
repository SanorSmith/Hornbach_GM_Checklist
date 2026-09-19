import { describe, expect, it } from 'vitest';
import { businessDateOf, isWeekend, weekdayOf, zoneOffsetMs, zonedToInstant } from './time';

const TZ = 'Europe/Stockholm';

/**
 * The paper says "senast kl 19:45". If that resolves an hour out for half the
 * year, every on-time figure in the reports is wrong and nobody trusts the
 * system again. Hence this file.
 */
describe('zonedToInstant', () => {
  it('resolves a winter (CET, UTC+1) deadline', () => {
    expect(zonedToInstant('2026-01-15', '19:45', TZ).toISOString()).toBe(
      '2026-01-15T18:45:00.000Z',
    );
  });

  it('resolves a summer (CEST, UTC+2) deadline', () => {
    expect(zonedToInstant('2026-07-15', '19:45', TZ).toISOString()).toBe(
      '2026-07-15T17:45:00.000Z',
    );
  });

  it('handles the day the clocks go forward', () => {
    // 2026-03-29: 02:00 CET becomes 03:00 CEST.
    expect(zonedToInstant('2026-03-29', '01:30', TZ).toISOString()).toBe(
      '2026-03-29T00:30:00.000Z',
    );
    expect(zonedToInstant('2026-03-29', '04:00', TZ).toISOString()).toBe(
      '2026-03-29T02:00:00.000Z',
    );
  });

  it('handles the day the clocks go back', () => {
    // 2026-10-25: 03:00 CEST becomes 02:00 CET.
    expect(zonedToInstant('2026-10-25', '01:00', TZ).toISOString()).toBe(
      '2026-10-24T23:00:00.000Z',
    );
    expect(zonedToInstant('2026-10-25', '04:00', TZ).toISOString()).toBe(
      '2026-10-25T03:00:00.000Z',
    );
  });

  it('supports a deadline that falls after midnight', () => {
    expect(zonedToInstant('2026-07-15', '01:00', TZ, 1).toISOString()).toBe(
      '2026-07-15T23:00:00.000Z',
    );
  });

  it('reports the offset that is actually in force', () => {
    expect(zoneOffsetMs(new Date('2026-01-15T12:00:00Z'), TZ)).toBe(3_600_000);
    expect(zoneOffsetMs(new Date('2026-07-15T12:00:00Z'), TZ)).toBe(7_200_000);
  });
});

describe('weekdays', () => {
  it('names the weekday of a business date', () => {
    expect(weekdayOf('2026-09-19', TZ)).toBe('SAT');
    expect(weekdayOf('2026-09-21', TZ)).toBe('MON');
  });

  it('identifies the weekend, which changes several deadlines', () => {
    // "…fram till 19:00 eller 17:00 på helgerna"
    expect(isWeekend('2026-09-19', TZ)).toBe(true);
    expect(isWeekend('2026-09-20', TZ)).toBe(true);
    expect(isWeekend('2026-09-21', TZ)).toBe(false);
  });
});

describe('businessDateOf', () => {
  it('uses the store\'s calendar day, not UTC\'s', () => {
    // 22:30Z on the 18th is already the 19th in Stockholm.
    expect(businessDateOf(new Date('2026-07-18T22:30:00Z'), TZ)).toBe('2026-07-19');
  });
});
