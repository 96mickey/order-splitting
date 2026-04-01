import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';
import {
  computeNextMarketOpen,
  getMarketExecutionTiming,
  isWithinMarketHours,
} from '../../order-splitter/timing';

/** Wall time in NY → UTC instant (typical production input is `DateTime.utc()` or `toUTC()`). */
function nyToUtcInstant(nyWall: DateTime): DateTime {
  return nyWall.toUTC();
}

describe('isWithinMarketHours', () => {
  it('is true Wednesday 11:00 ET (acceptance)', () => {
    const ny = DateTime.fromObject(
      { year: 2025, month: 1, day: 15, hour: 11, minute: 0, second: 0 },
      { zone: 'America/New_York' },
    );
    expect(isWithinMarketHours(ny)).toBe(true);
  });

  it('is false Wednesday 17:00 ET', () => {
    const ny = DateTime.fromObject(
      { year: 2025, month: 1, day: 15, hour: 17, minute: 0, second: 0 },
      { zone: 'America/New_York' },
    );
    expect(isWithinMarketHours(ny)).toBe(false);
  });

  it('is false at 16:00 ET (close is exclusive)', () => {
    const ny = DateTime.fromObject(
      { year: 2025, month: 1, day: 15, hour: 16, minute: 0, second: 0 },
      { zone: 'America/New_York' },
    );
    expect(isWithinMarketHours(ny)).toBe(false);
  });

  it('is true just before 16:00 ET', () => {
    const ny = DateTime.fromObject(
      { year: 2025, month: 1, day: 15, hour: 15, minute: 59, second: 59 },
      { zone: 'America/New_York' },
    );
    expect(isWithinMarketHours(ny)).toBe(true);
  });

  it('is false Saturday', () => {
    const ny = DateTime.fromObject(
      { year: 2025, month: 1, day: 18, hour: 12, minute: 0, second: 0 },
      { zone: 'America/New_York' },
    );
    expect(isWithinMarketHours(ny)).toBe(false);
  });
});

describe('getMarketExecutionTiming (acceptance)', () => {
  it('Wednesday 11:00 ET → IMMEDIATE with same-instant timestamp', () => {
    const ny = DateTime.fromObject(
      { year: 2025, month: 1, day: 15, hour: 11, minute: 0, second: 0 },
      { zone: 'America/New_York' },
    );
    const r = getMarketExecutionTiming(nyToUtcInstant(ny));
    expect(r.type).toBe('IMMEDIATE');
    expect(DateTime.fromISO(r.timestamp).toMillis()).toBe(ny.toMillis());
    expect(r.timestamp).toMatch(/T\d{2}:\d{2}:\d{2}/);
  });

  it('Wednesday 17:00 ET → SCHEDULED Thursday 09:30 ET', () => {
    const ny = DateTime.fromObject(
      { year: 2025, month: 1, day: 15, hour: 17, minute: 0, second: 0 },
      { zone: 'America/New_York' },
    );
    const expected = DateTime.fromObject(
      { year: 2025, month: 1, day: 16, hour: 9, minute: 30, second: 0 },
      { zone: 'America/New_York' },
    );
    const r = getMarketExecutionTiming(nyToUtcInstant(ny));
    expect(r.type).toBe('SCHEDULED');
    expect(DateTime.fromISO(r.timestamp).toMillis()).toBe(expected.toMillis());
  });

  it('Friday 17:00 ET → SCHEDULED Monday 09:30 ET', () => {
    const ny = DateTime.fromObject(
      { year: 2025, month: 1, day: 17, hour: 17, minute: 0, second: 0 },
      { zone: 'America/New_York' },
    );
    const expected = DateTime.fromObject(
      { year: 2025, month: 1, day: 20, hour: 9, minute: 30, second: 0 },
      { zone: 'America/New_York' },
    );
    const r = getMarketExecutionTiming(nyToUtcInstant(ny));
    expect(r.type).toBe('SCHEDULED');
    expect(DateTime.fromISO(r.timestamp).toMillis()).toBe(expected.toMillis());
  });

  it('Saturday any time → SCHEDULED Monday 09:30 ET', () => {
    const ny = DateTime.fromObject(
      { year: 2025, month: 1, day: 18, hour: 14, minute: 22, second: 0 },
      { zone: 'America/New_York' },
    );
    const expected = DateTime.fromObject(
      { year: 2025, month: 1, day: 20, hour: 9, minute: 30, second: 0 },
      { zone: 'America/New_York' },
    );
    const r = getMarketExecutionTiming(nyToUtcInstant(ny));
    expect(r.type).toBe('SCHEDULED');
    expect(DateTime.fromISO(r.timestamp).toMillis()).toBe(expected.toMillis());
  });

  it('Sunday any time → SCHEDULED Monday 09:30 ET', () => {
    const ny = DateTime.fromObject(
      { year: 2025, month: 1, day: 19, hour: 3, minute: 0, second: 0 },
      { zone: 'America/New_York' },
    );
    const expected = DateTime.fromObject(
      { year: 2025, month: 1, day: 20, hour: 9, minute: 30, second: 0 },
      { zone: 'America/New_York' },
    );
    const r = getMarketExecutionTiming(nyToUtcInstant(ny));
    expect(r.type).toBe('SCHEDULED');
    expect(DateTime.fromISO(r.timestamp).toMillis()).toBe(expected.toMillis());
  });
});

describe('getMarketExecutionTiming (edge / destructive)', () => {
  it('Wednesday 08:00 ET → SCHEDULED same day 09:30', () => {
    const ny = DateTime.fromObject(
      { year: 2025, month: 1, day: 15, hour: 8, minute: 0, second: 0 },
      { zone: 'America/New_York' },
    );
    const expected = DateTime.fromObject(
      { year: 2025, month: 1, day: 15, hour: 9, minute: 30, second: 0 },
      { zone: 'America/New_York' },
    );
    const r = getMarketExecutionTiming(nyToUtcInstant(ny));
    expect(r.type).toBe('SCHEDULED');
    expect(DateTime.fromISO(r.timestamp).toMillis()).toBe(expected.toMillis());
  });

  it('throws on invalid DateTime', () => {
    const bad = DateTime.fromISO('not-a-date');
    expect(() => getMarketExecutionTiming(bad)).toThrow(RangeError);
  });

  it('accepts non-UTC input by normalizing to UTC internally', () => {
    const ny = DateTime.fromObject(
      { year: 2025, month: 1, day: 15, hour: 11, minute: 0, second: 0 },
      { zone: 'America/New_York' },
    );
    const r = getMarketExecutionTiming(ny);
    expect(r.type).toBe('IMMEDIATE');
  });
});

describe('computeNextMarketOpen', () => {
  it('Friday after close lands on Monday open', () => {
    const ny = DateTime.fromObject(
      { year: 2025, month: 1, day: 17, hour: 16, minute: 0, second: 0 },
      { zone: 'America/New_York' },
    );
    const next = computeNextMarketOpen(ny);
    expect(next.weekday).toBe(1);
    expect(next.hour).toBe(9);
    expect(next.minute).toBe(30);
    expect(next.day).toBe(20);
  });

  it('throws when already inside regular session', () => {
    const ny = DateTime.fromObject(
      { year: 2025, month: 1, day: 15, hour: 11, minute: 0, second: 0 },
      { zone: 'America/New_York' },
    );
    expect(() => computeNextMarketOpen(ny)).toThrow(RangeError);
  });
});
