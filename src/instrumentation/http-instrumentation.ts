import http from "node:http";
import { generateId } from "../utils/id";
import { omitUndefined } from "../utils/object";
import { EventCategory, EventStatus, Severity, ActorType } from "../event/constants";
import { Collector } from "../collector/collector";
import { contextStore } from "../context/context-store";
import { contextManager } from "../context/context-manager";
import { TenantContext } from "../event/types";

export interface HttpServerInstrumentationOptions {
    collector: Collector;
    tenant: TenantContext;
    debug?: boolean;
}

export class HttpServerInstrumentation {
    private readonly collector: Collector;
    private readonly tenant: TenantContext;
    private readonly debug: boolean;
    private isPatched = false;

    private originalEmit = http.Server.prototype.emit;

    constructor(options: HttpServerInstrumentationOptions) {
        this.collector = options.collector;
        this.tenant = options.tenant;
        this.debug = options.debug ?? false;
    }

    register(): void {
        if (this.isPatched) {
            return;
        }

        const self = this;

        http.Server.prototype.emit = function (this: any, event: string, req: any, res: any, ...args: any[]) {
            if (event !== "request" || !(req instanceof http.IncomingMessage) || !(res instanceof http.ServerResponse)) {
                return self.originalEmit.apply(this, [event, req, res, ...args]);
            }

            // Loop prevention: do not instrument incoming SDK events ingestion requests
            if (req.url && (req.url.startsWith("/events") || req.url.includes("/v1/events"))) {
                return self.originalEmit.apply(this, [event, req, res, ...args]);
            }

            const startTime = Date.now();
            const clientIp =
                (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
                req.socket.remoteAddress ||
                "127.0.0.1";

            const requestId = (req.headers["x-request-id"] as string) || generateId();
            const traceId = (req.headers["x-trace-id"] as string) || generateId();
            const parentEventId = req.headers["x-span-id"] as string;

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

            // Initialize request context
            const requestCtx = contextManager.create({
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
            return contextStore.run(requestCtx, () => {
                // Record Request Started
                void self.collector
                    .collect<any>({
                        category: EventCategory.HTTP,
                        type: "request.started",
                        action: EventStatus.STARTED,
                        severity: Severity.INFO,
                        message: `Incoming Request: ${req.method} ${req.url}`,
                        http: omitUndefined({
                            method: req.method as any,
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

                const logResponse = (failed = false, error?: Error) => {
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
                    const route = requestCtx.metadata["route"] as string | undefined;

                    // Safely capture request body
                    let body: any = undefined;
                    const anyReq = req as any;
                    if (anyReq.body !== undefined && anyReq.body !== null) {
                        if (Buffer.isBuffer(anyReq.body)) {
                            body = "[Buffer]";
                        } else if (anyReq.body.pipe && typeof anyReq.body.pipe === "function") {
                            body = "[Stream]";
                        } else if (typeof anyReq.body === "string") {
                            body = anyReq.body.length > 5000 ? anyReq.body.substring(0, 5000) + "... [truncated]" : anyReq.body;
                        } else if (typeof anyReq.body === "object") {
                            try {
                                const serialized = JSON.stringify(anyReq.body);
                                if (serialized.length > 5000) {
                                    body = `[Object too large to log, size: ${serialized.length} bytes]`;
                                } else {
                                    body = anyReq.body;
                                }
                            } catch (e) {
                                body = "[Unserializable Object]";
                            }
                        } else {
                            body = anyReq.body;
                        }
                    }

                    // Extract actor / tenant context if set dynamically by middleware
                    const tokenData = anyReq.tokenData || anyReq.user || anyReq.authenticatedUser;
                    if (tokenData && typeof tokenData === "object") {
                        if (!requestCtx.actor) {
                            requestCtx.actor = {
                                type: ActorType.USER,
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
                        .collect<any>({
                            category: EventCategory.HTTP,
                            type: success ? "request.finished" : "request.failed",
                            action: success ? EventStatus.SUCCESS : EventStatus.FAILED,
                            severity: success ? Severity.INFO : Severity.ERROR,
                            message: `Request Completed: ${req.method} ${req.url} - ${statusCode} (${duration}ms)`,
                            duration,
                            http: omitUndefined({
                                method: req.method as any,
                                url: req.url || "/",
                                statusCode,
                                responseSize,
                                clientIp,
                                route,
                                userAgent: req.headers["user-agent"],
                                referer: req.headers["referer"] as string,
                                headers: Object.keys(requestHeaders).length > 0 ? requestHeaders : undefined,
                                query,
                                body,
                            }) as any,
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

                req.on("error", (err: Error) => {
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

    unregister(): void {
        if (!this.isPatched) {
            return;
        }

        http.Server.prototype.emit = this.originalEmit;
        this.isPatched = false;

        if (this.debug) {
            console.log("[LogSense] Native HTTP Server Instrumentation unregistered.");
        }
    }
}

/**
 * Express Middleware helper.
 * Enriches request route properties dynamically inside the current context.
 */
export function expressMiddleware() {
    return (req: any, res: any, next: any) => {
        const activeCtx = contextStore.get();
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
export function fastifyPlugin() {
    return (fastify: any, opts: any, done: any) => {
        fastify.addHook("preHandler", (request: any, reply: any, next: any) => {
            const activeCtx = contextStore.get();
            if (activeCtx && request.routeOptions) {
                activeCtx.metadata["route"] = request.routeOptions.url;
            }
            next();
        });
        done();
    };
}
