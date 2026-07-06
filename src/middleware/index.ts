/**
 * @module @utkarshpayal/logsense-sdk/express
 *
 * Express middleware for automatic HTTP observability.
 *
 * @example
 * ```ts
 * import { logsenseMiddleware } from "@utkarshpayal/logsense-sdk/express";
 * ```
 */
export { logsenseMiddleware } from "./express.js";
export type { LogSenseMiddlewareOptions, RequestLogContext } from "./express.js";
