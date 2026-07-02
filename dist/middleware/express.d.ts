import type { ErrorRequestHandler, RequestHandler } from "express";
import { LogSenseClient } from "../core/sdk.js";
declare global {
    namespace Express {
        interface Request {
            /** LogSense request context attached by logsenseMiddleware. */
            logsense: {
                /** The resolved request ID for this HTTP transaction. */
                requestId: string;
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
 * Creates an Express middleware pair (request logger + error logger) that
 * automatically captures every HTTP transaction using an existing
 * `LogSenseClient` instance.
 *
 * ### What is automatically captured
 * - **Incoming requests** — method, URL, route, IP, user-agent, request ID, timestamp
 * - **Outgoing responses** — status code, duration, content-length, request ID
 * - **Slow requests** — logged at WARN when duration exceeds `slowThresholdMs`
 * - **Unhandled route errors** — stack, name, message, request ID logged at ERROR
 *
 * ### Usage
 * ```ts
 * import express from "express";
 * import { LogSense } from "@logsense/node";
 * import { logsenseMiddleware } from "@logsense/node/express";
 *
 * const app = express();
 * const logger = new LogSense({ apiKey: "...", service: "my-api", environment: "production" });
 *
 * // Mount before all routes
 * app.use(logsenseMiddleware(logger));
 *
 * // With options
 * app.use(logsenseMiddleware(logger, {
 *   slowThresholdMs: 500,
 *   metadata: { version: "2.0.0" },
 * }));
 * ```
 *
 * @param client   An initialised `LogSenseClient` (or `LogSense`) instance.
 * @param options  Optional middleware configuration.
 * @returns        A tuple of `[requestHandler, errorHandler]` ready for `app.use()`.
 */
export declare function logsenseMiddleware(client: LogSenseClient, options?: LogSenseMiddlewareOptions): [RequestHandler, ErrorRequestHandler];
//# sourceMappingURL=express.d.ts.map