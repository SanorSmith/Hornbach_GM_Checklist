import { describe, expect, it } from 'vitest';
import { formatDate, formatDateTime, formatRemaining, formatTime } from './utils';

/**
 * These tests exist because of a specific, twice-a-year failure mode: the
 * checklists are written in Swedish wall-clock time ("senast kl 19:45"), and a
 * device or server in another zone must never shift that. Formatting is pinned
 * to Europe/Stockholm, so it has to survive both CET and CEST.
 */
describe('store-local formatting', () => {
  it('renders summer (CEST, UTC+2) instants as Stockholm wall-clock', () => {
    // 17:45Z in July is 19:45 in Stockholm.
    expect(formatTime('2026-07-15T17:45:00Z')).toBe('19:45');
    expect(formatDate('2026-07-15T17:45:00Z')).toBe('2026-07-15');
  });

  it('renders winter (CET, UTC+1) instants as Stockholm wall-clock', () => {
    // 18:45Z in January is the same 19:45 in Stockholm.
    expect(formatTime('2026-01-15T18:45:00Z')).toBe('19:45');
  });

  it('handles the DST transition without drifting an hour', () => {
    // Last Sunday in March 2026 is the 29th: 01:00Z is 02:00 CET -> 03:00 CEST.
    expect(formatTime('2026-03-29T00:30:00Z')).toBe('01:30');
    expect(formatTime('2026-03-29T01:30:00Z')).toBe('03:30');
  });

  it('always uses 24-hour time, never AM/PM', () => {
    const formatted = formatDateTime('2026-09-19T17:42:00Z');
    expect(formatted).toContain('19:42');
    expect(formatted).not.toMatch(/[AP]M/i);
  });

  it('rolls a late-evening UTC instant into the next Swedish date', () => {
    // 22:30Z on the 18th is already 00:30 on the 19th in Stockholm.
    expect(formatDate('2026-07-18T22:30:00Z')).toBe('2026-07-19');
  });
});

describe('formatRemaining', () => {
  const now = new Date('2026-09-19T06:00:00Z');

  it('reports minutes left before a deadline', () => {
    expect(formatRemaining('2026-09-19T06:25:00Z', now)).toBe('25 min');
  });

  it('reports hours and minutes for longer gaps', () => {
    expect(formatRemaining('2026-09-19T08:05:00Z', now)).toBe('2 h 5 min');
  });

  it('marks an overdue item with a leading minus rather than a negative count', () => {
    expect(formatRemaining('2026-09-19T05:48:00Z', now)).toBe('-12 min');
  });
});
