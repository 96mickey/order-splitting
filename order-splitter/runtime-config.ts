/** Immutable default price when partner does not supply a stock price (USD). */
export const DEFAULT_PRICE = 100;

/** NYSE calendar semantics for execution timing (non-configurable per spec). */
export const MARKET_TIMEZONE = 'America/New_York';

export interface OrderSplitterConfigSnapshot {
  defaultPrice: number;
  marketTimezone: string;
  maxDecimalPlaces: number;
}

/** Only mutable slice of runtime config (initial default per architecture doc). */
let maxDecimalPlaces = 3;

export function getConfigSnapshot(): OrderSplitterConfigSnapshot {
  return {
    defaultPrice: DEFAULT_PRICE,
    marketTimezone: MARKET_TIMEZONE,
    maxDecimalPlaces,
  };
}

/**
 * @throws RangeError if value is not an integer in [0, 10]
 */
export function setMaxDecimalPlaces(value: number): void {
  if (!Number.isInteger(value) || value < 0 || value > 10) {
    throw new RangeError('maxDecimalPlaces must be an integer from 0 to 10');
  }
  maxDecimalPlaces = value;
}
