import type { OrderRequest, OrderType, Portfolio, Stock } from '../types/order.models';
import {
  ORDER_SPLITTER_ERROR_CODES,
  type OrderSplitterErrorCode,
} from '../errors/order-splitter-error-codes';
import { MAX_STOCKS_PER_ORDER } from '../constants';
import { getConfigSnapshot } from '../runtime-config';
import { exceedsAllowedDecimalPlaces } from './decimal-precision';

/** Architecture: portfolio weights must sum to 100% within this tolerance. */
const WEIGHT_SUM_TARGET = 100;
const WEIGHT_SUM_TOLERANCE = 0.01;

export interface SplitOrderValidationError {
  code: OrderSplitterErrorCode;
  message: string;
}

export type SplitOrderValidationResult =
  | { ok: true; value: OrderRequest }
  | { ok: false; error: SplitOrderValidationError };

/** Per-stock branch uses `stock` instead of `value` to keep discriminated unions unambiguous. */
type StockEntryResult =
  | { ok: true; stock: Stock }
  | { ok: false; error: SplitOrderValidationError };

function fail(code: OrderSplitterErrorCode, message: string): SplitOrderValidationResult {
  return { ok: false, error: { code, message } };
}

function stockFieldError(code: OrderSplitterErrorCode, message: string): StockEntryResult {
  return { ok: false, error: { code, message } };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isOrderType(value: unknown): value is OrderType {
  return value === 'BUY' || value === 'SELL';
}

function validateStockEntry(
  raw: Record<string, unknown>,
  index: number,
  maxDecimals: number,
): StockEntryResult {
  if (!('weight' in raw)) {
    return stockFieldError(
      ORDER_SPLITTER_ERROR_CODES.MALFORMED_REQUEST,
      `stocks[${index}].weight is required`,
    );
  }

  const { weight, price, symbol } = raw;

  if (typeof weight !== 'number' || Number.isNaN(weight)) {
    return stockFieldError(
      ORDER_SPLITTER_ERROR_CODES.MALFORMED_REQUEST,
      `stocks[${index}].weight must be a number`,
    );
  }

  if (!Number.isFinite(weight) || weight < 0) {
    return stockFieldError(
      ORDER_SPLITTER_ERROR_CODES.INVALID_WEIGHT_VALUE,
      `stocks[${index}].weight must be a finite number >= 0`,
    );
  }

  if (exceedsAllowedDecimalPlaces(weight, maxDecimals)) {
    return stockFieldError(
      ORDER_SPLITTER_ERROR_CODES.INVALID_PRECISION,
      `stocks[${index}].weight must use at most ${maxDecimals} decimal places`,
    );
  }

  if (symbol !== undefined && symbol !== null && typeof symbol !== 'string') {
    return stockFieldError(
      ORDER_SPLITTER_ERROR_CODES.MALFORMED_REQUEST,
      `stocks[${index}].symbol must be a string when provided`,
    );
  }

  if (price !== undefined && price !== null) {
    if (typeof price !== 'number' || Number.isNaN(price)) {
      return stockFieldError(
        ORDER_SPLITTER_ERROR_CODES.INVALID_PRICE,
        `stocks[${index}].price must be a number when provided`,
      );
    }
    if (!Number.isFinite(price) || price <= 0) {
      return stockFieldError(
        ORDER_SPLITTER_ERROR_CODES.INVALID_PRICE,
        `stocks[${index}].price must be a finite number greater than zero`,
      );
    }
    if (exceedsAllowedDecimalPlaces(price, maxDecimals)) {
      return stockFieldError(
        ORDER_SPLITTER_ERROR_CODES.INVALID_PRECISION,
        `stocks[${index}].price must use at most ${maxDecimals} decimal places`,
      );
    }
  }

  const stock: Stock = { weight };
  if (typeof symbol === 'string') {
    stock.symbol = symbol;
  }
  if (typeof price === 'number' && !Number.isNaN(price)) {
    stock.price = price;
  }

  return { ok: true, stock };
}

/**
 * Validates a parsed JSON body for `POST /orders/split`.
 * Runs every structural and business rule before split logic executes.
 */
export function validateSplitOrderPayload(body: unknown): SplitOrderValidationResult {
  if (!isPlainObject(body)) {
    return fail(
      ORDER_SPLITTER_ERROR_CODES.MALFORMED_REQUEST,
      'Request body must be a JSON object',
    );
  }

  const { totalAmount, orderType, stocks } = body;

  if (!Array.isArray(stocks)) {
    return fail(
      ORDER_SPLITTER_ERROR_CODES.MALFORMED_REQUEST,
      'Field "stocks" must be an array',
    );
  }

  if (stocks.length > MAX_STOCKS_PER_ORDER) {
    return fail(
      ORDER_SPLITTER_ERROR_CODES.PORTFOLIO_TOO_LARGE,
      `Portfolio cannot exceed ${MAX_STOCKS_PER_ORDER} stocks (got ${stocks.length})`,
    );
  }

  if (stocks.length === 0) {
    return fail(
      ORDER_SPLITTER_ERROR_CODES.EMPTY_PORTFOLIO,
      'Portfolio must contain at least one stock',
    );
  }

  if (typeof orderType !== 'string' || !isOrderType(orderType)) {
    return fail(
      ORDER_SPLITTER_ERROR_CODES.INVALID_ORDER_TYPE,
      'orderType must be BUY or SELL',
    );
  }

  if (typeof totalAmount !== 'number' || Number.isNaN(totalAmount)) {
    return fail(
      ORDER_SPLITTER_ERROR_CODES.MALFORMED_REQUEST,
      'totalAmount must be a number',
    );
  }

  if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
    return fail(
      ORDER_SPLITTER_ERROR_CODES.INVALID_AMOUNT,
      'totalAmount must be a finite number greater than zero',
    );
  }

  const maxDecimals = getConfigSnapshot().maxDecimalPlaces;

  if (exceedsAllowedDecimalPlaces(totalAmount, maxDecimals)) {
    return fail(
      ORDER_SPLITTER_ERROR_CODES.INVALID_PRECISION,
      `totalAmount must use at most ${maxDecimals} decimal places`,
    );
  }

  const portfolio: Portfolio = [];

  for (let i = 0; i < stocks.length; i += 1) {
    const raw = stocks[i];
    if (!isPlainObject(raw)) {
      return fail(
        ORDER_SPLITTER_ERROR_CODES.MALFORMED_REQUEST,
        `stocks[${i}] must be an object`,
      );
    }

    const entry = validateStockEntry(raw, i, maxDecimals);
    if (!entry.ok) {
      return { ok: false, error: entry.error };
    }
    portfolio.push(entry.stock);
  }

  const sum = portfolio.reduce((acc, s) => acc + s.weight, 0);
  if (Math.abs(sum - WEIGHT_SUM_TARGET) > WEIGHT_SUM_TOLERANCE) {
    return fail(
      ORDER_SPLITTER_ERROR_CODES.INVALID_WEIGHTS,
      `Stock weights must sum to ${WEIGHT_SUM_TARGET} (±${WEIGHT_SUM_TOLERANCE}), got ${sum}`,
    );
  }

  const value: OrderRequest = {
    totalAmount,
    orderType,
    stocks: portfolio,
  };
  return { ok: true, value };
}
