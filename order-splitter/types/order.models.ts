/**
 * Request/response contracts for the Order Splitter API (architecture doc).
 * Validation narrows untrusted JSON into these shapes before any business logic runs.
 */

/** Supported execution side for a portfolio order. */
export type OrderType = 'BUY' | 'SELL';

/**
 * One line in the partner-supplied portfolio: target weight and optional per-symbol price.
 * `symbol` is optional at validation time (split engine may require it later).
 */
export interface Stock {
  symbol?: string;
  /** Portfolio weight as a percentage of the whole book (0–100+ until sum check). */
  weight: number;
  /** When omitted, runtime default price applies during splitting. */
  price?: number;
}

/** Non-empty list of stocks after successful validation. */
export type Portfolio = Stock[];

/**
 * Partner payload to split a single total notional across weighted legs.
 */
export interface OrderRequest {
  totalAmount: number;
  orderType: OrderType;
  stocks: Portfolio;
}

/**
 * Successful split outcome from `POST /orders/split` (engine + metadata).
 * Prefer importing `SplitLineBreakdown` / `SplitOrderEngineResult` from `order-splitter/split` for engine fields.
 */
export interface OrderResponse {
  status: 'accepted';
  /** Placeholder until persistence / id generation exists. */
  orderId: null;
}

/**
 * Standard error envelope returned by HTTP when `APIError.machineCode` is set
 * (mirrors `ArchitectureErrorEnvelope` in `types/errors.ts`).
 */
export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    requestId: string;
  };
}
