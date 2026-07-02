"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpClientInstrumentation = void 0;
const node_http_1 = __importDefault(require("node:http"));
const node_https_1 = __importDefault(require("node:https"));
const node_url_1 = require("node:url");
const constants_1 = require("../event/constants");
const context_store_1 = require("../context/context-store");
class HttpClientInstrumentation {
    collector;
    sdkEndpoint;
    debug;
    isPatched = false;
    originalHttpRequest = node_http_1.default.request;
    originalHttpsRequest = node_https_1.default.request;
    constructor(options) {
        this.collector = options.collector;
        this.sdkEndpoint = options.sdkEndpoint;
        this.debug = options.debug ?? false;
    }
    register() {
        if (this.isPatched) {
            return;
        }
        const self = this;
        // Helper to check if request is going to our LogSense server
        const isLogSenseRequest = (options) => {
            try {
                let host = "";
                let path = "";
                if (typeof options === "string") {
                    const parsed = new node_url_1.URL(options);
                    host = parsed.host;
                    path = parsed.pathname;
                }
                else if (options instanceof node_url_1.URL) {
                    host = options.host;
                    path = options.pathname;
                }
                else if (options) {
                    const hostname = options.hostname || options.host || "localhost";
                    const port = options.port ? `:${options.port}` : "";
                    host = `${hostname}${port}`;
                    path = options.path || "/";
                }
                const sdkUrl = new node_url_1.URL(self.sdkEndpoint);
                // If hosts match and path starts with the same, it's SDK traffic
                return host === sdkUrl.host && path.startsWith(sdkUrl.pathname);
            }
            catch {
                return false;
            }
        };
        // Wrap request functions
        const wrapRequest = (originalReq, protocol) => {
            return function (...args) {
                const arg0 = args[0];
                const arg1 = args[1];
                let options = {};
                let callback = undefined;
                if (typeof arg0 === "string" || arg0 instanceof node_url_1.URL) {
                    if (typeof arg1 === "object") {
                        options = { ...arg1 };
                        callback = args[2];
                    }
                    else if (typeof arg1 === "function") {
                        callback = arg1;
                    }
                }
                else if (typeof arg0 === "object") {
                    options = { ...arg0 };
                    callback = arg1;
                }
                // If this is traffic going to the LogSense collector, execute original request directly
                if (isLogSenseRequest(arg0) || isLogSenseRequest(options)) {
                    return originalReq.apply(this, args);
                }
                const startTime = Date.now();
                const method = options.method || "GET";
                let requestUrl = "";
                try {
                    if (typeof arg0 === "string") {
                        requestUrl = arg0;
                    }
                    else if (arg0 instanceof node_url_1.URL) {
                        requestUrl = arg0.toString();
                    }
                    else {
                        const host = options.hostname || options.host || "localhost";
                        const path = options.path || "/";
                        requestUrl = `${protocol}//${host}${path}`;
                    }
                }
                catch {
                    requestUrl = "unknown";
                }
                // Retrieve current trace context to enable propagation
                const activeCtx = context_store_1.contextStore.get();
                if (activeCtx) {
                    options.headers = options.headers || {};
                    options.headers["x-trace-id"] = activeCtx.traceId;
                    options.headers["x-request-id"] = activeCtx.requestId;
                    if (activeCtx.spanId) {
                        options.headers["x-span-id"] = activeCtx.spanId;
                    }
                }
                const clientReq = originalReq.apply(this, args);
                let responseRecorded = false;
                const recordRequestFinished = (statusCode, error) => {
                    if (responseRecorded) {
                        return;
                    }
                    responseRecorded = true;
                    const duration = Date.now() - startTime;
                    const success = error === undefined && statusCode !== undefined && statusCode < 400;
                    const relationships = activeCtx
                        ? {
                            traceId: activeCtx.traceId,
                            requestId: activeCtx.requestId,
                            ...(activeCtx.spanId ? { spanId: activeCtx.spanId } : {}),
                            ...(activeCtx.sessionId ? { sessionId: activeCtx.sessionId } : {}),
                        }
                        : undefined;
                    const metadata = error
                        ? {
                            errorName: error.name,
                            errorMessage: error.message,
                            ...(error.stack ? { errorStack: error.stack } : {}),
                        }
                        : undefined;
                    void self.collector
                        .collect({
                        category: constants_1.EventCategory.EXTERNAL,
                        type: "http.request",
                        action: success ? constants_1.EventStatus.SUCCESS : constants_1.EventStatus.FAILED,
                        severity: success ? constants_1.Severity.INFO : constants_1.Severity.ERROR,
                        message: `HTTP ${method} ${requestUrl} - ${statusCode || "Failed"}`,
                        duration,
                        relationships,
                        external: {
                            provider: "http",
                            method,
                            url: requestUrl,
                            statusCode,
                            success,
                        },
                        metadata,
                    })
                        .catch((err) => {
                        if (self.debug) {
                            console.error("[LogSense] Failed to collect external request event:", err);
                        }
                    });
                };
                clientReq.on("response", (res) => {
                    res.on("end", () => {
                        recordRequestFinished(res.statusCode);
                    });
                });
                clientReq.on("error", (err) => {
                    recordRequestFinished(undefined, err);
                });
                return clientReq;
            };
        };
        node_http_1.default.request = wrapRequest(this.originalHttpRequest, "http:");
        // Also wrap http.get
        node_http_1.default.get = function (...args) {
            const req = node_http_1.default.request.apply(this, args);
            req.end();
            return req;
        };
        node_https_1.default.request = wrapRequest(this.originalHttpsRequest, "https:");
        // Also wrap https.get
        node_https_1.default.get = function (...args) {
            const req = node_https_1.default.request.apply(this, args);
            req.end();
            return req;
        };
        this.isPatched = true;
        if (this.debug) {
            console.log("[LogSense] HTTP/HTTPS Outgoing Client Instrumentation registered.");
        }
    }
    unregister() {
        if (!this.isPatched) {
            return;
        }
        node_http_1.default.request = this.originalHttpRequest;
        node_https_1.default.request = this.originalHttpsRequest;
        this.isPatched = false;
        if (this.debug) {
            console.log("[LogSense] HTTP/HTTPS Outgoing Client Instrumentation unregistered.");
        }
    }
}
exports.HttpClientInstrumentation = HttpClientInstrumentation;
//# sourceMappingURL=http-client-instrumentation.js.map