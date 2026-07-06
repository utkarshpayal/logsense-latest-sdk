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
function logsenseMiddleware(client, options = {}) {
    const { metadata = {} } = options;
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
        const activeCtx = context_store_js_1.contextStore.get();
        const requestId = activeCtx?.requestId ?? (0, request_id_js_1.extractRequestId)(req);
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
                environment: config.environment,
                service: config.service ?? "",
            },
            actor: undefined,
            metadata: { ...buildBaseMetadata(requestId, method, path) },
        };
        context_store_js_1.contextStore.run(requestContext, () => {
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
