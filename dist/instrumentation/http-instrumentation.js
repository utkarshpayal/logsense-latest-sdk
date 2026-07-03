"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpServerInstrumentation = void 0;
exports.expressMiddleware = expressMiddleware;
exports.fastifyPlugin = fastifyPlugin;
const node_http_1 = __importDefault(require("node:http"));
const id_1 = require("../utils/id");
const object_1 = require("../utils/object");
const constants_1 = require("../event/constants");
const context_store_1 = require("../context/context-store");
const context_manager_1 = require("../context/context-manager");
class HttpServerInstrumentation {
    collector;
    tenant;
    debug;
    isPatched = false;
    originalEmit = node_http_1.default.Server.prototype.emit;
    constructor(options) {
        this.collector = options.collector;
        this.tenant = options.tenant;
        this.debug = options.debug ?? false;
    }
    register() {
        if (this.isPatched) {
            return;
        }
        const self = this;
        node_http_1.default.Server.prototype.emit = function (event, req, res, ...args) {
            if (event !== "request" || !(req instanceof node_http_1.default.IncomingMessage) || !(res instanceof node_http_1.default.ServerResponse)) {
                return self.originalEmit.apply(this, [event, req, res, ...args]);
            }
            // Loop prevention: do not instrument incoming SDK events ingestion requests
            if (req.url && (req.url.startsWith("/events") || req.url.includes("/v1/events"))) {
                return self.originalEmit.apply(this, [event, req, res, ...args]);
            }
            const startTime = Date.now();
            const clientIp = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
                req.socket.remoteAddress ||
                "127.0.0.1";
            const requestId = req.headers["x-request-id"] || (0, id_1.generateId)();
            const traceId = req.headers["x-trace-id"] || (0, id_1.generateId)();
            const parentEventId = req.headers["x-span-id"];
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
            // Initialize request context
            const requestCtx = context_manager_1.contextManager.create({
                tenant: self.tenant,
                requestId,
                traceId,
                parentEventId,
                metadata: {
                    url: req.url || "/",
                    method: req.method || "GET",
                    clientIp,
                },
            });
            // Run request handler inside context
            return context_store_1.contextStore.run(requestCtx, () => {
                // Record Request Started
                void self.collector
                    .collect({
                    category: constants_1.EventCategory.HTTP,
                    type: "request.started",
                    action: constants_1.EventStatus.STARTED,
                    severity: constants_1.Severity.INFO,
                    message: `Incoming Request: ${req.method} ${req.url}`,
                    http: (0, object_1.omitUndefined)({
                        method: req.method,
                        url: req.url || "/",
                        clientIp,
                        userAgent: req.headers["user-agent"],
                        headers: Object.keys(requestHeaders).length > 0 ? requestHeaders : undefined,
                        query,
                    }),
                })
                    .catch((err) => {
                    if (self.debug) {
                        console.error("[LogSense] Failed to collect request start event:", err);
                    }
                });
                let responseLogged = false;
                const logResponse = (failed = false, error) => {
                    if (responseLogged) {
                        return;
                    }
                    responseLogged = true;
                    const duration = Date.now() - startTime;
                    const statusCode = res.statusCode;
                    const success = !failed && statusCode < 400;
                    const responseSizeStr = res.getHeader("content-length");
                    const responseSize = responseSizeStr ? parseInt(String(responseSizeStr), 10) : undefined;
                    // Read route if set by a routing framework
                    const route = requestCtx.metadata["route"];
                    // Safely capture request body
                    let body = undefined;
                    const anyReq = req;
                    if (anyReq.body !== undefined && anyReq.body !== null) {
                        if (Buffer.isBuffer(anyReq.body)) {
                            body = "[Buffer]";
                        }
                        else if (anyReq.body.pipe && typeof anyReq.body.pipe === "function") {
                            body = "[Stream]";
                        }
                        else if (typeof anyReq.body === "string") {
                            body = anyReq.body.length > 5000 ? anyReq.body.substring(0, 5000) + "... [truncated]" : anyReq.body;
                        }
                        else if (typeof anyReq.body === "object") {
                            try {
                                const serialized = JSON.stringify(anyReq.body);
                                if (serialized.length > 5000) {
                                    body = `[Object too large to log, size: ${serialized.length} bytes]`;
                                }
                                else {
                                    body = anyReq.body;
                                }
                            }
                            catch (e) {
                                body = "[Unserializable Object]";
                            }
                        }
                        else {
                            body = anyReq.body;
                        }
                    }
                    // Extract actor / tenant context if set dynamically by middleware
                    const tokenData = anyReq.tokenData || anyReq.user || anyReq.authenticatedUser;
                    if (tokenData && typeof tokenData === "object") {
                        if (!requestCtx.actor) {
                            requestCtx.actor = {
                                type: constants_1.ActorType.USER,
                                id: tokenData.id || tokenData._id || tokenData.sub,
                                name: tokenData.name,
                                email: tokenData.email,
                                role: tokenData.userType || tokenData.role,
                            };
                        }
                        if (tokenData.organizationId && !requestCtx.tenant.organizationId) {
                            requestCtx.tenant.organizationId = tokenData.organizationId;
                        }
                    }
                    void self.collector
                        .collect({
                        category: constants_1.EventCategory.HTTP,
                        type: success ? "request.finished" : "request.failed",
                        action: success ? constants_1.EventStatus.SUCCESS : constants_1.EventStatus.FAILED,
                        severity: success ? constants_1.Severity.INFO : constants_1.Severity.ERROR,
                        message: `Request Completed: ${req.method} ${req.url} - ${statusCode} (${duration}ms)`,
                        duration,
                        http: (0, object_1.omitUndefined)({
                            method: req.method,
                            url: req.url || "/",
                            statusCode,
                            responseSize,
                            clientIp,
                            route,
                            userAgent: req.headers["user-agent"],
                            referer: req.headers["referer"],
                            headers: Object.keys(requestHeaders).length > 0 ? requestHeaders : undefined,
                            query,
                            body,
                        }),
                        metadata: error
                            ? {
                                errorName: error.name,
                                errorMessage: error.message,
                            }
                            : undefined,
                    })
                        .catch((err) => {
                        if (self.debug) {
                            console.error("[LogSense] Failed to collect request completion event:", err);
                        }
                    });
                };
                res.on("finish", () => {
                    logResponse(false);
                });
                res.on("close", () => {
                    // If connection closed before finish event, it was likely aborted
                    logResponse(!res.writableFinished);
                });
                req.on("error", (err) => {
                    logResponse(true, err);
                });
                // Execute original request handler
                return self.originalEmit.apply(this, [event, req, res, ...args]);
            });
        };
        this.isPatched = true;
        if (this.debug) {
            console.log("[LogSense] Native HTTP Server Instrumentation registered.");
        }
    }
    unregister() {
        if (!this.isPatched) {
            return;
        }
        node_http_1.default.Server.prototype.emit = this.originalEmit;
        this.isPatched = false;
        if (this.debug) {
            console.log("[LogSense] Native HTTP Server Instrumentation unregistered.");
        }
    }
}
exports.HttpServerInstrumentation = HttpServerInstrumentation;
/**
 * Express Middleware helper.
 * Enriches request route properties dynamically inside the current context.
 */
function expressMiddleware() {
    return (req, res, next) => {
        const activeCtx = context_store_1.contextStore.get();
        if (activeCtx) {
            // Wait until route resolution happens to record route path
            res.on("finish", () => {
                if (req.route) {
                    activeCtx.metadata["route"] = req.route.path;
                }
            });
        }
        next();
    };
}
/**
 * Fastify Plugin helper.
 * Enriches request route properties dynamically inside the current context.
 */
function fastifyPlugin() {
    return (fastify, opts, done) => {
        fastify.addHook("preHandler", (request, reply, next) => {
            const activeCtx = context_store_1.contextStore.get();
            if (activeCtx && request.routeOptions) {
                activeCtx.metadata["route"] = request.routeOptions.url;
            }
            next();
        });
        done();
    };
}
//# sourceMappingURL=http-instrumentation.js.map