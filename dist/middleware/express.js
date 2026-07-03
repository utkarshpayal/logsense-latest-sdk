"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logsenseMiddleware = logsenseMiddleware;
const node_os_1 = __importDefault(require("node:os"));
const context_store_js_1 = require("../context/context-store.js");
const request_id_js_1 = require("../utils/request-id.js");
const object_js_1 = require("../utils/object.js");
const constants_js_1 = require("../event/constants.js");
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
            // Parse query parameters
            let query = undefined;
            if (req.url) {
                try {
                    const parsedUrl = new URL(req.url, "http://localhost");
                    const qObj = {};
                    parsedUrl.searchParams.forEach((val, key) => {
                        qObj[key] = val;
                    });
                    if (Object.keys(qObj).length > 0) {
                        query = qObj;
                    }
                }
                catch (e) {
                    const parts = req.url.split("?");
                    if (parts.length > 1) {
                        const qObj = {};
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
            const requestHeaders = {};
            for (const [key, val] of Object.entries(req.headers)) {
                if (typeof val === "string") {
                    requestHeaders[key] = val;
                }
                else if (Array.isArray(val)) {
                    requestHeaders[key] = val.join(", ");
                }
            }
            // Log incoming request
            logger.info(`→ ${method} ${path}`, (0, object_js_1.omitUndefined)({
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
            }));
            res.on("finish", () => {
                const durationMs = hrToMs(process.hrtime.bigint() - startTime);
                const statusCode = res.statusCode;
                const contentLength = res.getHeader("content-length");
                const route = req.route?.path;
                // Safely capture request body
                let body = undefined;
                if (req.body !== undefined && req.body !== null) {
                    if (Buffer.isBuffer(req.body)) {
                        body = "[Buffer]";
                    }
                    else if (req.body.pipe && typeof req.body.pipe === "function") {
                        body = "[Stream]";
                    }
                    else if (typeof req.body === "string") {
                        body = req.body.length > 5000 ? req.body.substring(0, 5000) + "... [truncated]" : req.body;
                    }
                    else if (typeof req.body === "object") {
                        try {
                            const serialized = JSON.stringify(req.body);
                            if (serialized.length > 5000) {
                                body = `[Object too large to log, size: ${serialized.length} bytes]`;
                            }
                            else {
                                body = req.body;
                            }
                        }
                        catch (e) {
                            body = "[Unserializable Object]";
                        }
                    }
                    else {
                        body = req.body;
                    }
                }
                // Extract actor / tenant context if set dynamically by middleware
                const tokenData = req.tokenData || req.user || req.authenticatedUser;
                if (tokenData && typeof tokenData === "object") {
                    if (!requestContext.actor) {
                        requestContext.actor = {
                            type: constants_js_1.ActorType.USER,
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
                const responseMeta = (0, object_js_1.omitUndefined)({
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