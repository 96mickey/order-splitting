/**
 * Operational limits for order-splitter (defense in depth vs huge payloads / DoS).
 * Request body size is still capped by Express `bodyParser.json` limit.
 */

/** Maximum number of `stocks` entries allowed on a single split order. */
export const MAX_STOCKS_PER_ORDER = 1000;
