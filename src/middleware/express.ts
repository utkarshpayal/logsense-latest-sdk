import os from "node:os";
import type { Request, Response, NextFunction, ErrorRequestHandler, RequestHandler } from "express";
import { LogSenseClient } from "../core/sdk.js";
import { contextStore } from "../context/context-store.js";
import { extractRequestId } from "../utils/request-id.js";
import type { Metadata } from "../event/types.js";
import { omitUndefined } from "../utils/object.js";
import { ActorType } from "../event/constants.js";

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
 * Internal helpers
 * ───────────────────────────────────────────────────────────── */

function hrToMs(diff: bigint): number {
    return Number(diff / 1_000_000n);
}

/* ─────────────────────────────────────────────────────────────
 * Middleware factory
 * ───────────────────────────────────────────────────────────── */

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
export function logsenseMiddleware(
    client: LogSenseClient,
    options: LogSenseMiddlewareOptions = {},
): [RequestHandler, ErrorRequestHandler] {
    const { slowThresholdMs = 1000, metadata = {} } = options;
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
        const requestId = extractRequestId(req);
        const startTime = process.hrtime.bigint();

        // Attach to req so downstream route handlers can access it
        req.logsense = { requestId };

        // Set request ID on the response for client correlation
        res.setHeader("X-Request-ID", requestId);

        const method = req.method;
        const path = req.path ?? req.url;
        const ip = req.ip ?? req.socket?.remoteAddress;
        const userAgent = req.headers["user-agent"];

        const baseMeta = buildBaseMetadata(requestId, method, path);

        // Build a RequestContext for AsyncLocalStorage propagation
        const requestContext = {
            traceId: requestId,
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
            metadata: { ...baseMeta } as Record<string, unknown>,
        };

        /* Run the entire request lifecycle inside the context store so that
           any log emitted within a route handler automatically inherits the
           requestId, traceId, method, and path. */
        contextStore.run(requestContext as any, () => {
            // Parse query parameters
            let query: any = undefined;
            if (req.url) {
                try {
                    const parsedUrl = new URL(req.url, "http://localhost");
                    const qObj: Record<string, string> = {};
                    parsedUrl.searchParams.forEach((val, key) => {
                        qObj[key] = val;
                    });
                    if (Object.keys(qObj).length > 0) {
                        query = qObj;
                    }
                } catch (e) {
                    const parts = req.url.split("?");
                    if (parts.length > 1) {
                        const qObj: Record<string, string> = {};
                        const params = new URLSearchParams(parts[1]);
                        params.forEach((val, key) => {
                            qObj[key] = val;
                        });
                        if (Object.keys(qObj).length > 0) {
                            query = qObj;
                        }
                    }
                }
            }

            // Safely capture headers
            const requestHeaders: Record<string, string> = {};
            for (const [key, val] of Object.entries(req.headers)) {
                if (typeof val === "string") {
                    requestHeaders[key] = val;
                } else if (Array.isArray(val)) {
                    requestHeaders[key] = val.join(", ");
                }
            }

            // Log incoming request
            logger.info(`→ ${method} ${path}`, omitUndefined({
                ...baseMeta,
                ...(ip !== undefined ? { ip } : {}),
                ...(userAgent !== undefined ? { userAgent } : {}),
                event: "request.incoming",
                http: {
                    method,
                    url: req.url || "/",
                    clientIp: ip,
                    userAgent,
                    headers: Object.keys(requestHeaders).length > 0 ? requestHeaders : undefined,
                    query,
                }
            }) as any);

            res.on("finish", () => {
                const durationMs = hrToMs(process.hrtime.bigint() - startTime);
                const statusCode = res.statusCode;
                const contentLength = res.getHeader("content-length");
                const route = req.route?.path as string | undefined;

                // Safely capture request body
                let body: any = undefined;
                if (req.body !== undefined && req.body !== null) {
                    if (Buffer.isBuffer(req.body)) {
                        body = "[Buffer]";
                    } else if (req.body.pipe && typeof req.body.pipe === "function") {
                        body = "[Stream]";
                    } else if (typeof req.body === "string") {
                        body = req.body.length > 5000 ? req.body.substring(0, 5000) + "... [truncated]" : req.body;
                    } else if (typeof req.body === "object") {
                        try {
                            const serialized = JSON.stringify(req.body);
                            if (serialized.length > 5000) {
                                body = `[Object too large to log, size: ${serialized.length} bytes]`;
                            } else {
                                body = req.body;
                            }
                        } catch (e) {
                            body = "[Unserializable Object]";
                        }
                    } else {
                        body = req.body;
                    }
                }

                // Extract actor / tenant context if set dynamically by middleware
                const tokenData = (req as any).tokenData || (req as any).user || (req as any).authenticatedUser;
                if (tokenData && typeof tokenData === "object") {
                    if (!requestContext.actor) {
                        requestContext.actor = {
                            type: ActorType.USER,
                            id: tokenData.id || tokenData._id || tokenData.sub,
                            name: tokenData.name,
                            email: tokenData.email,
                            role: tokenData.userType || tokenData.role,
                        };
                    }
                    if (tokenData.organizationId && !requestContext.tenant.organizationId) {
                        requestContext.tenant.organizationId = tokenData.organizationId;
                    }
                }

                const responseMeta: any = omitUndefined({
                    ...baseMeta,
                    ...(route !== undefined ? { route } : {}),
                    statusCode,
                    durationMs,
                    event: "request.completed",
                    ...(contentLength !== undefined ? { contentLength: Number(contentLength) } : {}),
                    http: {
                        method,
                        url: req.url || "/",
                        statusCode,
                        clientIp: ip,
                        route,
                        userAgent,
                        headers: Object.keys(requestHeaders).length > 0 ? requestHeaders : undefined,
                        query,
                        body,
                    }
                });

                if (durationMs > slowThresholdMs) {
                    logger.warn(`⚠ Slow request: ${method} ${path} completed in ${durationMs}ms`, {
                        ...responseMeta,
                        event: "request.slow",
                        slowThresholdMs,
                    });
                } else {
                    logger.info(`← ${method} ${path} ${statusCode} (${durationMs}ms)`, responseMeta);
                }
            });

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
