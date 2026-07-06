import os from "node:os";
import type { Request, Response, NextFunction, ErrorRequestHandler, RequestHandler } from "express";
import { LogSenseClient } from "../core/sdk.js";
import { contextStore } from "../context/context-store.js";
import { extractRequestId } from "../utils/request-id.js";
import type { Metadata } from "../event/types.js";

/* ─────────────────────────────────────────────────────────────
 * Express type augmentation
 * Exposes req.logsense.requestId to downstream route handlers.
 * ───────────────────────────────────────────────────────────── */
declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
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

/* ─────────────────────────────────────────────────────────────
 * Public API Types
 * ───────────────────────────────────────────────────────────── */

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

/* ─────────────────────────────────────────────────────────────
 * Middleware factory
 * ───────────────────────────────────────────────────────────── */

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
export function logsenseMiddleware(
    client: LogSenseClient,
    options: LogSenseMiddlewareOptions = {},
): [RequestHandler, ErrorRequestHandler] {
    const { metadata = {} } = options;
    const { logger, config } = client;

    const hostname = os.hostname();

    /** Build the base metadata merged into every log record. */
    function buildBaseMetadata(requestId: string, method: string, path: string): Metadata {
        return {
            requestId,
            method,
            path,
            hostname,
            ...(config.service !== undefined ? { service: config.service } : {}),
            environment: String(config.environment),
            ...metadata,
        } satisfies Metadata;
    }

    /* ── Request / Response handler ── */
    const requestHandler: RequestHandler = (req: Request, res: Response, next: NextFunction): void => {
        const activeCtx = contextStore.get();
        const requestId = activeCtx?.requestId ?? extractRequestId(req);
        const traceId = activeCtx?.traceId ?? ((typeof req.headers["x-trace-id"] === "string" && req.headers["x-trace-id"].trim().length > 0)
            ? req.headers["x-trace-id"]
            : requestId);

        // Attach to req so downstream route handlers can access it
        req.logsense = { requestId, traceId };

        // Set request ID on the response for client correlation
        res.setHeader("X-Request-ID", requestId);

        if (activeCtx) {
            next();
            return;
        }

        const method = req.method;
        const path = req.path ?? req.url;

        // Build a RequestContext for AsyncLocalStorage propagation.
        const requestContext = {
            traceId,
            requestId,
            spanId: undefined,
            sessionId: undefined,
            tenant: {
                organizationId: config.organizationId ?? "",
                projectId: config.projectId ?? "",
                environment: config.environment as any,
                service: config.service ?? "",
            },
            actor: undefined as any,
            metadata: { ...buildBaseMetadata(requestId, method, path) } as Record<string, unknown>,
        };

        contextStore.run(requestContext as any, () => {
            next();
        });
    };

    /* ── Error handler (must be 4-arity for Express to treat it as error middleware) ── */
    const errorHandler: ErrorRequestHandler = (
        err: unknown,
        req: Request,
        res: Response,
        next: NextFunction,
    ): void => {
        const requestId = req.logsense?.requestId ?? extractRequestId(req);
        const method = req.method;
        const path = req.path ?? req.url;

        const error = err instanceof Error ? err : new Error(String(err));

        logger.error(`✖ Unhandled route error: ${error.message}`, error, {
            ...buildBaseMetadata(requestId, method, path),
            event: "request.error",
            errorName: error.name,
            ...(error.stack !== undefined ? { stack: error.stack } : {}),
        });

        next(err);
    };

    return [requestHandler, errorHandler];
}
