/**
 * Detects values that need more fractional digits than `maxDecimalPlaces` allows.
 * Uses scaled rounding so we do not depend on IEEE string formatting quirks.
 */

const SCALE_EPSILON = 1e-7;

/**
 * @returns true when `value` is not representable with at most `maxDecimalPlaces` digits after the decimal point.
 */
export function exceedsAllowedDecimalPlaces(value: number, maxDecimalPlaces: number): boolean {
  if (!Number.isFinite(value)) {
    return false;
  }
  const factor = 10 ** maxDecimalPlaces;
  const scaled = value * factor;
  const nearest = Math.round(scaled);
  return Math.abs(scaled - nearest) > SCALE_EPSILON;
}
