import { DateTime } from 'luxon';
import { MARKET_TIMEZONE } from '../runtime-config';

/** Session type returned to callers (architecture doc). */
export type ExecutionTimingType = 'IMMEDIATE' | 'SCHEDULED';

export interface MarketExecutionTimingResult {
  type: ExecutionTimingType;
  /** ISO-8601 with offset (Luxon `toISO()`), in `America/New_York` wall time for the instant. */
  timestamp: string;
}

const OPEN_HOUR = 9;
const OPEN_MINUTE = 30;
const CLOSE_HOUR = 16;
const CLOSE_MINUTE = 0;

/** Monday–Friday, NYSE regular session (16:00 end is exclusive). */
function sessionOpenOnDay(dayStart: DateTime): DateTime {
  return dayStart.set({
    hour: OPEN_HOUR,
    minute: OPEN_MINUTE,
    second: 0,
    millisecond: 0,
  });
}

function sessionCloseOnDay(dayStart: DateTime): DateTime {
  return dayStart.set({
    hour: CLOSE_HOUR,
    minute: CLOSE_MINUTE,
    second: 0,
    millisecond: 0,
  });
}

function isWeekday(dt: DateTime): boolean {
  return dt.weekday >= 1 && dt.weekday <= 5;
}

/**
 * True when `ny` falls in [09:30, 16:00) America/New_York on Mon–Fri.
 */
export function isWithinMarketHours(ny: DateTime): boolean {
  if (!isWeekday(ny)) {
    return false;
  }
  const dayStart = ny.startOf('day');
  const open = sessionOpenOnDay(dayStart);
  const close = sessionCloseOnDay(dayStart);
  return ny >= open && ny < close;
}

/**
 * Next regular-session open at 09:30 ET (skips nights, weekends, and post-close same day).
 *
 * Do not call while {@link isWithinMarketHours} is true — use {@link getMarketExecutionTiming} instead.
 */
export function computeNextMarketOpen(ny: DateTime): DateTime {
  const dayStart = ny.startOf('day');
  const open = sessionOpenOnDay(dayStart);
  const close = sessionCloseOnDay(dayStart);

  if (isWeekday(ny) && ny >= open && ny < close) {
    throw new RangeError('computeNextMarketOpen: current time is already within market hours');
  }

  if (isWeekday(ny) && ny < open) {
    return open;
  }

  // After today's close on a weekday, or any moment on a weekend: scan from next calendar day.
  let cursor = dayStart.plus({ days: 1 });
  while (cursor.weekday === 6 || cursor.weekday === 7) {
    cursor = cursor.startOf('day').plus({ days: 1 });
  }

  return sessionOpenOnDay(cursor.startOf('day'));
}

/**
 * Decides whether execution is **IMMEDIATE** (inside regular market hours) or **SCHEDULED**
 * (next session open at 09:30 ET).
 *
 * Pure: no I/O; pass the clock as `nowUtc` (any valid Luxon instant; normalized to UTC).
 *
 * @param nowUtc — “Current” time as an absolute instant (typically `DateTime.utc()` in production).
 */
export function getMarketExecutionTiming(nowUtc: DateTime): MarketExecutionTimingResult {
  if (!nowUtc.isValid) {
    throw new RangeError(`Invalid DateTime: ${nowUtc.invalidReason ?? 'unknown'}`);
  }

  const ny = nowUtc.toUTC().setZone(MARKET_TIMEZONE);

  if (isWithinMarketHours(ny)) {
    const ts = ny.toISO();
    if (ts === null) {
      throw new RangeError('Could not serialize timestamp');
    }
    return { type: 'IMMEDIATE', timestamp: ts };
  }

  const nextOpen = computeNextMarketOpen(ny);
  const ts = nextOpen.toISO();
  if (ts === null) {
    throw new RangeError('Could not serialize next market open');
  }
  return { type: 'SCHEDULED', timestamp: ts };
}
