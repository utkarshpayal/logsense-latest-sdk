"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logsenseMiddleware = logsenseMiddleware;
const node_os_1 = __importDefault(require("node:os"));
const context_store_js_1 = require("../context/context-store.js");
const request_id_js_1 = require("../utils/request-id.js");
/* ─────────────────────────────────────────────────────────────
 * Internal helpers
 * ───────────────────────────────────────────────────────────── */
function hrToMs(diff) {
    return Number(diff / 1000000n);
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
function logsenseMiddleware(client, options = {}) {
    const { slowThresholdMs = 1000, metadata = {} } = options;
    const { logger, config } = client;
    const hostname = node_os_1.default.hostname();
    /** Build the base metadata merged into every log record. */
    function buildBaseMetadata(requestId, method, path) {
        return {
            requestId,
            method,
            path,
            hostname,
            ...(config.service !== undefined ? { service: config.service } : {}),
            environment: String(config.environment),
            ...metadata,
        };
    }
    /* ── Request / Response handler ── */
    const requestHandler = (req, res, next) => {
        const requestId = (0, request_id_js_1.extractRequestId)(req);
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
                environment: config.environment,
                service: config.service ?? "",
            },
            actor: undefined,
            metadata: { ...baseMeta },
        };
        /* Run the entire request lifecycle inside the context store so that
           any log emitted within a route handler automatically inherits the
           requestId, traceId, method, and path. */
        context_store_js_1.contextStore.run(requestContext, () => {
            // Log incoming request
            logger.info(`→ ${method} ${path}`, {
                ...baseMeta,
                ...(ip !== undefined ? { ip } : {}),
                ...(userAgent !== undefined ? { userAgent } : {}),
                event: "request.incoming",
            });
            res.on("finish", () => {
                const durationMs = hrToMs(process.hrtime.bigint() - startTime);
                const statusCode = res.statusCode;
                const contentLength = res.getHeader("content-length");
                const route = req.route?.path;
                const responseMeta = {
                    ...baseMeta,
                    ...(route !== undefined ? { route } : {}),
                    statusCode,
                    durationMs,
                    event: "request.completed",
                    ...(contentLength !== undefined ? { contentLength: Number(contentLength) } : {}),
                };
                if (durationMs > slowThresholdMs) {
                    logger.warn(`⚠ Slow request: ${method} ${path} completed in ${durationMs}ms`, {
                        ...responseMeta,
                        event: "request.slow",
                        slowThresholdMs,
                    });
                }
                else {
                    logger.info(`← ${method} ${path} ${statusCode} (${durationMs}ms)`, responseMeta);
                }
            });
            next();
        });
    };
    /* ── Error handler (must be 4-arity for Express to treat it as error middleware) ── */
    const errorHandler = (err, req, res, next) => {
        const requestId = req.logsense?.requestId ?? (0, request_id_js_1.extractRequestId)(req);
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
//# sourceMappingURL=express.js.map