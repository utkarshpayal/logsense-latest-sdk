import http from "node:http";
import https from "node:https";
import { URL } from "node:url";
import { EventCategory, EventStatus, Severity } from "../event/constants";
import { Collector } from "../collector/collector";
import { contextStore } from "../context/context-store";

export interface HttpClientInstrumentationOptions {
    collector: Collector;
    sdkEndpoint: string;
    debug?: boolean;
}

export class HttpClientInstrumentation {
    private readonly collector: Collector;
    private readonly sdkEndpoint: string;
    private readonly debug: boolean;
    private isPatched = false;

    private originalHttpRequest = http.request;
    private originalHttpsRequest = https.request;

    constructor(options: HttpClientInstrumentationOptions) {
        this.collector = options.collector;
        this.sdkEndpoint = options.sdkEndpoint;
        this.debug = options.debug ?? false;
    }

    register(): void {
        if (this.isPatched) {
            return;
        }

        const self = this;

        // Helper to check if request is going to our LogSense server
        const isLogSenseRequest = (options: any): boolean => {
            try {
                let host = "";
                let path = "";

                if (typeof options === "string") {
                    const parsed = new URL(options);
                    host = parsed.host;
                    path = parsed.pathname;
                } else if (options instanceof URL) {
                    host = options.host;
                    path = options.pathname;
                } else if (options) {
                    const hostname = options.hostname || options.host || "localhost";
                    const port = options.port ? `:${options.port}` : "";
                    host = `${hostname}${port}`;
                    path = options.path || "/";
                }

                const sdkUrl = new URL(self.sdkEndpoint);
                // If hosts match and path starts with the same, it's SDK traffic
                return host === sdkUrl.host && path.startsWith(sdkUrl.pathname);
            } catch {
                return false;
            }
        };

        // Wrap request functions
        const wrapRequest = (originalReq: any, protocol: string) => {
            return function (this: any, ...args: any[]): http.ClientRequest {
                const arg0 = args[0];
                const arg1 = args[1];

                let options: any = {};
                let callback: any = undefined;

                if (typeof arg0 === "string" || arg0 instanceof URL) {
                    if (typeof arg1 === "object") {
                        options = { ...arg1 };
                        callback = args[2];
                    } else if (typeof arg1 === "function") {
                        callback = arg1;
                    }
                } else if (typeof arg0 === "object") {
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
                    } else if (arg0 instanceof URL) {
                        requestUrl = arg0.toString();
                    } else {
                        const host = options.hostname || options.host || "localhost";
                        const path = options.path || "/";
                        requestUrl = `${protocol}//${host}${path}`;
                    }
                } catch {
                    requestUrl = "unknown";
                }

                // Retrieve current trace context to enable propagation
                const activeCtx = contextStore.get();
                if (activeCtx) {
                    options.headers = options.headers || {};
                    options.headers["x-trace-id"] = activeCtx.traceId;
                    options.headers["x-request-id"] = activeCtx.requestId;
                    if (activeCtx.spanId) {
                        options.headers["x-span-id"] = activeCtx.spanId;
                    }
                }

                const clientReq: http.ClientRequest = originalReq.apply(this, args);

                let responseRecorded = false;

                const recordRequestFinished = (statusCode?: number, error?: Error) => {
                    if (responseRecorded) {
                        return;
                    }
                    responseRecorded = true;

                    const duration = Date.now() - startTime;
                    const success = error === undefined && statusCode !== undefined && statusCode < 400;

                    const relationships: any = activeCtx
                        ? {
                              traceId: activeCtx.traceId,
                              requestId: activeCtx.requestId,
                              parentEventId: activeCtx.spanId || activeCtx.parentEventId,
                              ...(activeCtx.spanId ? { spanId: activeCtx.spanId } : {}),
                              ...(activeCtx.sessionId ? { sessionId: activeCtx.sessionId } : {}),
                          }
                        : undefined;

                    const metadata: any = error
                        ? {
                              errorName: error.name,
                              errorMessage: error.message,
                              ...(error.stack ? { errorStack: error.stack } : {}),
                          }
                        : undefined;

                    void self.collector
                        .collect<any>({
                            category: EventCategory.EXTERNAL,
                            type: "http.request",
                            action: success ? EventStatus.SUCCESS : EventStatus.FAILED,
                            severity: success ? Severity.INFO : Severity.ERROR,
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

                clientReq.on("response", (res: http.IncomingMessage) => {
                    res.on("end", () => {
                        recordRequestFinished(res.statusCode);
                    });
                });

                clientReq.on("error", (err: Error) => {
                    recordRequestFinished(undefined, err);
                });

                return clientReq;
            };
        };

        (http as any).request = wrapRequest(this.originalHttpRequest, "http:");
        // Also wrap http.get
        (http as any).get = function (this: any, ...args: any[]) {
            const req = http.request.apply(this, args as any);
            req.end();
            return req;
        };

        (https as any).request = wrapRequest(this.originalHttpsRequest, "https:");
        // Also wrap https.get
        (https as any).get = function (this: any, ...args: any[]) {
            const req = https.request.apply(this, args as any);
            req.end();
            return req;
        };

        this.isPatched = true;

        if (this.debug) {
            console.log("[LogSense] HTTP/HTTPS Outgoing Client Instrumentation registered.");
        }
    }

    unregister(): void {
        if (!this.isPatched) {
            return;
        }

        http.request = this.originalHttpRequest;
        https.request = this.originalHttpsRequest;
        this.isPatched = false;

        if (this.debug) {
            console.log("[LogSense] HTTP/HTTPS Outgoing Client Instrumentation unregistered.");
        }
    }
}
