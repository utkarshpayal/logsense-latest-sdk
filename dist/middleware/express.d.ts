import type { ErrorRequestHandler, RequestHandler } from "express";
import { LogSenseClient } from "../core/sdk.js";
declare global {
    namespace Express {
        interface Request {
            /** LogSense request context attached by logsenseMiddleware. */
            logsense: {
                /** The resolved request ID for this HTTP transaction. */
                requestId: string;
                /** The resolved trace ID for this HTTP transaction. */
                traceId?: string;
            };
        }
    }
}
/**
 * Options accepted by `logsenseMiddleware`.
 */
export interface LogSenseMiddlewareOptions {
    /**
     * Duration threshold in milliseconds above which a request is
     * considered "slow" and logged at WARN level.
     * @default 1000
     */
    slowThresholdMs?: number;
    /**
     * Additional metadata merged into every log entry produced by
     * the middleware (e.g. `{ service: "payment-api", version: "1.0.0" }`).
     */
    metadata?: Record<string, string | number | boolean>;
}
/**
 * Shape of the structured log context emitted per HTTP transaction.
 */
export interface RequestLogContext {
    requestId: string;
    traceId?: string;
    method: string;
    path: string;
    route: string | undefined;
    ip: string | undefined;
    userAgent: string | undefined;
    hostname: string;
    service: string | undefined;
    environment: string;
}
/**
 * Creates an Express middleware pair that initializes HTTP request context
 * for the current request and enables AsyncLocalStorage propagation.
 *
 * ### What this middleware does
 * - creates and attaches `req.logsense.requestId`
 * - resolves and attaches `traceId`
 * - sets `X-Request-ID` on the response
 * - runs the route inside AsyncLocalStorage context
 * - forwards unhandled route errors to Express error middleware
 *
 * ### Usage
 * ```ts
 * import express from "express";
 * import { LogSense } from "@utkarshpayal/logsense-sdk";
 * import { logsenseMiddleware } from "@utkarshpayal/logsense-sdk/express";
 *
 * const app = express();
 * const logger = new LogSense({ apiKey: "...", service: "my-api", environment: "production" });
 *
 * // Mount before all routes
 * const [logRequests, logErrors] = logsenseMiddleware(logger);
 * app.use(logRequests);
 * // Register routes here.
 * app.use(logErrors);
 *
 * // With options
 * const [requestLogger, errorLogger] = logsenseMiddleware(logger, {
 *   slowThresholdMs: 500,
 *   metadata: { version: "2.0.0" },
 * });
 * app.use(requestLogger);
 * // Register routes here.
 * app.use(errorLogger);
 * ```
 *
 * @param client   An initialised `LogSenseClient` (or `LogSense`) instance.
 * @param options  Optional middleware configuration.
 * @returns        A tuple of `[requestHandler, errorHandler]` ready for `app.use()`.
 */
export declare function logsenseMiddleware(client: LogSenseClient, options?: LogSenseMiddlewareOptions): [RequestHandler, ErrorRequestHandler];
//# sourceMappingURL=express.d.ts.map