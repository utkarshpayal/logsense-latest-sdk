/**
 * Integration tests for logsenseMiddleware (Express V2).
 *
 * These tests run an in-process Express server and verify that the middleware:
 *   1. Logs incoming requests with expected fields
 *   2. Logs outgoing responses with status code and duration
 *   3. Logs slow requests at WARN level
 *   4. Captures route errors at ERROR level with stack + requestId
 *   5. Attaches req.logsense.requestId for downstream handlers
 *   6. Respects X-Request-ID header from clients
 *   7. Merges custom metadata into every log entry
 *   8. ProcessPlugin installs and uninstalls cleanly
 */

import http from "node:http";
import express, { Request, Response, NextFunction } from "express";
import { LogSenseClient } from "../src/core/sdk.js";
import { logsenseMiddleware, type LogSenseMiddlewareOptions } from "../src/middleware/express.js";
import { ProcessPlugin } from "../src/plugins/process.js";
import { LogSenseLogger } from "../src/logger/logger.js";
import { Metadata } from "../src/event/types.js";

/* ─────────────────────────────────────────────────────────────
 * Test Harness
 * ───────────────────────────────────────────────────────────── */

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: boolean, message: string): void {
    if (condition) {
        console.log(`  ✓ ${message}`);
        passed++;
    } else {
        console.error(`  ✗ ${message}`);
        failed++;
        failures.push(message);
    }
}

function section(name: string): void {
    console.log(`\n┌─ ${name}`);
}

/* ─────────────────────────────────────────────────────────────
 * Mock Logger
 * Records all log calls for assertion.
 * ───────────────────────────────────────────────────────────── */

interface LogEntry {
    level: "trace" | "debug" | "info" | "warn" | "error" | "fatal";
    message: string;
    metadata?: Metadata;
    error?: Error | unknown;
}

class MockLogger implements LogSenseLogger {
    readonly entries: LogEntry[] = [];

    trace(message: string, metadata?: Metadata): void {
        this.entries.push({ level: "trace", message, ...(metadata ? { metadata } : {}) });
    }
    debug(message: string, metadata?: Metadata): void {
        this.entries.push({ level: "debug", message, ...(metadata ? { metadata } : {}) });
    }
    info(message: string, metadata?: Metadata): void {
        this.entries.push({ level: "info", message, ...(metadata ? { metadata } : {}) });
    }
    warn(message: string, metadata?: Metadata): void {
        this.entries.push({ level: "warn", message, ...(metadata ? { metadata } : {}) });
    }
    error(message: string, error?: Error | unknown, metadata?: Metadata): void {
        this.entries.push({ level: "error", message, ...(error ? { error } : {}), ...(metadata ? { metadata } : {}) });
    }
    fatal(message: string, error?: Error | unknown, metadata?: Metadata): void {
        this.entries.push({ level: "fatal", message, ...(error ? { error } : {}), ...(metadata ? { metadata } : {}) });
    }

    /** Find entries matching a level. */
    forLevel(level: LogEntry["level"]): LogEntry[] {
        return this.entries.filter((e) => e.level === level);
    }

    /** Find entries whose message contains a string. */
    withMessage(substring: string): LogEntry[] {
        return this.entries.filter((e) => e.message.includes(substring));
    }

    reset(): void {
        this.entries.length = 0;
    }
}

/* ─────────────────────────────────────────────────────────────
 * Test Server Factory
 * Creates a minimal Express app with logsenseMiddleware, optional routes,
 * and returns a promise-based HTTP client.
 * ───────────────────────────────────────────────────────────── */

interface TestServerResult {
    close: () => Promise<void>;
    request: (opts: {
        method?: string;
        path: string;
        headers?: Record<string, string>;
        /** Delay to wait for async finish event (ms) */
        settle?: number;
    }) => Promise<{ statusCode: number; headers: http.IncomingHttpHeaders }>;
    mockLogger: MockLogger;
}

function createTestServer(
    routeSetup: (app: express.Express) => void,
    middlewareOptions?: LogSenseMiddlewareOptions,
): TestServerResult {
    const mockLogger = new MockLogger();

    // Create a minimal LogSenseClient stub — we only care about `.logger` and `.config`
    // We avoid a real SDK init (which would need apiKey, orgId, projectId) by directly
    // constructing a minimal object that satisfies what logsenseMiddleware needs.
    const fakeClient = {
        logger: mockLogger,
        config: {
            service: "test-service",
            environment: "test",
            organizationId: "test-org",
            projectId: "test-project",
        },
    } as unknown as LogSenseClient;

    const app = express();
    const [requestHandler, errorHandler] = logsenseMiddleware(fakeClient, middlewareOptions);

    app.use(requestHandler);
    routeSetup(app);
    app.use(errorHandler);

    const server = http.createServer(app);

    return {
        mockLogger,
        close: () =>
            new Promise<void>((resolve, reject) => {
                server.close((err) => (err ? reject(err) : resolve()));
            }),
        request: ({ method = "GET", path, headers = {}, settle = 50 }) =>
            new Promise<{ statusCode: number; headers: http.IncomingHttpHeaders }>((resolve, reject) => {
                if (!server.listening) {
                    server.listen(0); // Random free port
                }
                const port = (server.address() as { port: number }).port;

                const req = http.request(
                    { hostname: "127.0.0.1", port, path, method, headers },
                    (res) => {
                        res.resume(); // Drain body
                        res.on("end", () => {
                            // Give finish event time to fire and logs to be written
                            setTimeout(() => resolve({ statusCode: res.statusCode ?? 0, headers: res.headers }), settle);
                        });
                    },
                );
                req.on("error", reject);
                req.end();
            }),
    };
}

/* ─────────────────────────────────────────────────────────────
 * Tests
 * ───────────────────────────────────────────────────────────── */

async function testRequestLogging(): Promise<void> {
    section("1. Incoming request logging");

    const srv = createTestServer((app) => {
        app.get("/health", (_req: Request, res: Response) => res.status(200).json({ ok: true }));
    });

    try {
        await srv.request({ path: "/health" });

        const infoEntries = srv.mockLogger.forLevel("info");
        const incomingEntry = infoEntries.find((e) => e.message.includes("→") && e.message.includes("/health"));

        assert(incomingEntry !== undefined, "Logs an incoming request entry");

        const meta = incomingEntry?.metadata ?? {};
        assert(typeof meta["requestId"] === "string" && (meta["requestId"] as string).length > 0, "requestId is present in metadata");
        assert(meta["method"] === "GET", "method is captured");
        assert(meta["path"] === "/health", "path is captured");
        assert(meta["service"] === "test-service", "service is captured from config");
        assert(meta["environment"] === "test", "environment is captured from config");
        assert(meta["event"] === "request.incoming", "event tag is 'request.incoming'");
    } finally {
        await srv.close();
    }
}

async function testResponseLogging(): Promise<void> {
    section("2. Outgoing response logging");

    const srv = createTestServer((app) => {
        app.get("/ping", (_req: Request, res: Response) => res.status(200).send("pong"));
    });

    try {
        await srv.request({ path: "/ping" });

        const infoEntries = srv.mockLogger.forLevel("info");
        const responseEntry = infoEntries.find(
            (e) => e.message.includes("←") && e.message.includes("/ping") && e.message.includes("200"),
        );

        assert(responseEntry !== undefined, "Logs an outgoing response entry");

        const meta = responseEntry?.metadata ?? {};
        assert(meta["statusCode"] === 200, "statusCode is captured");
        assert(typeof meta["durationMs"] === "number", "durationMs is a number");
        assert((meta["durationMs"] as number) >= 0, "durationMs is non-negative");
        assert(meta["event"] === "request.completed", "event tag is 'request.completed'");
    } finally {
        await srv.close();
    }
}

async function testSlowRequestWarning(): Promise<void> {
    section("3. Slow request warning");

    const srv = createTestServer(
        (app) => {
            app.get("/slow", (_req: Request, res: Response) => {
                setTimeout(() => res.status(200).send("done"), 80);
            });
        },
        { slowThresholdMs: 50 }, // Threshold lower than the handler delay
    );

    try {
        await srv.request({ path: "/slow", settle: 200 });

        const warnEntries = srv.mockLogger.forLevel("warn");
        const slowEntry = warnEntries.find((e) => e.message.includes("Slow request"));

        assert(slowEntry !== undefined, "Emits a WARN for slow requests");

        const meta = slowEntry?.metadata ?? {};
        assert(meta["event"] === "request.slow", "event tag is 'request.slow'");
        assert(typeof meta["durationMs"] === "number" && (meta["durationMs"] as number) > 50, "durationMs exceeds threshold");
        assert(meta["slowThresholdMs"] === 50, "slowThresholdMs is included in metadata");
    } finally {
        await srv.close();
    }
}

async function testErrorHandlerLogging(): Promise<void> {
    section("4. Unhandled route error logging");

    const srv = createTestServer((app) => {
        app.get("/boom", (_req: Request, _res: Response, _next: NextFunction) => {
            throw new Error("Something went wrong");
        });
        // Express 5 handles sync throws automatically; for Express 4 we'd need next(err)
        // The error middleware is added by createTestServer via errorHandler.
    });

    try {
        await srv.request({ path: "/boom" });

        const errorEntries = srv.mockLogger.forLevel("error");
        assert(errorEntries.length > 0, "Logs an error entry for route errors");

        const errorEntry = errorEntries[0];
        assert(errorEntry !== undefined, "Error entry exists");

        const meta = errorEntry?.metadata ?? {};
        assert(errorEntry?.message.includes("Unhandled route error"), "Message indicates route error");
        assert(meta["event"] === "request.error", "event tag is 'request.error'");
        assert(typeof meta["requestId"] === "string", "requestId is present on error entry");
        assert(meta["errorName"] === "Error", "errorName is captured");
    } finally {
        await srv.close();
    }
}

async function testRequestIdPropagation(): Promise<void> {
    section("5. req.logsense.requestId is set for downstream handlers");

    let capturedRequestId: string | undefined;

    const srv = createTestServer((app) => {
        app.get("/id-check", (req: Request, res: Response) => {
            capturedRequestId = req.logsense?.requestId;
            res.status(200).json({ requestId: capturedRequestId });
        });
    });

    try {
        await srv.request({ path: "/id-check" });
        assert(typeof capturedRequestId === "string" && capturedRequestId.length > 0, "req.logsense.requestId is set in route handler");
    } finally {
        await srv.close();
    }
}

async function testExistingRequestIdRespected(): Promise<void> {
    section("6. Existing X-Request-ID header is forwarded");

    let capturedRequestId: string | undefined;

    const srv = createTestServer((app) => {
        app.get("/passthrough", (req: Request, res: Response) => {
            capturedRequestId = req.logsense?.requestId;
            res.status(200).send("ok");
        });
    });

    const providedId = "my-custom-trace-id-12345";

    try {
        await srv.request({ path: "/passthrough", headers: { "x-request-id": providedId } });
        assert(capturedRequestId === providedId, "Existing X-Request-ID is preserved in req.logsense.requestId");

        const entries = srv.mockLogger.entries;
        const hasProvidedId = entries.some((e) => e.metadata?.["requestId"] === providedId);
        assert(hasProvidedId, "Provided request ID appears in log metadata");
    } finally {
        await srv.close();
    }
}

async function testXRequestIdResponseHeader(): Promise<void> {
    section("7. X-Request-ID response header is set");

    const srv = createTestServer((app) => {
        app.get("/check-header", (_req: Request, res: Response) => res.status(204).end());
    });

    try {
        const { headers } = await srv.request({ path: "/check-header" });
        assert(typeof headers["x-request-id"] === "string" && (headers["x-request-id"] as string).length > 0, "X-Request-ID response header is set");
    } finally {
        await srv.close();
    }
}

async function testCustomMetadata(): Promise<void> {
    section("8. Custom metadata is merged into all log entries");

    const srv = createTestServer(
        (app) => {
            app.get("/meta-check", (_req: Request, res: Response) => res.status(200).send("ok"));
        },
        {
            metadata: { version: "2.0.0", region: "us-east-1" },
        },
    );

    try {
        await srv.request({ path: "/meta-check" });

        const entries = srv.mockLogger.entries;
        const withVersion = entries.filter((e) => e.metadata?.["version"] === "2.0.0");
        const withRegion = entries.filter((e) => e.metadata?.["region"] === "us-east-1");

        assert(withVersion.length > 0, "Custom metadata 'version' appears in log entries");
        assert(withRegion.length > 0, "Custom metadata 'region' appears in log entries");
    } finally {
        await srv.close();
    }
}

async function testProcessPlugin(): Promise<void> {
    section("9. ProcessPlugin install/uninstall lifecycle");

    const mockLogger = new MockLogger();
    const fakeClient = {
        logger: mockLogger,
        config: { service: "test", environment: "test" },
        shutdown: async () => {},
    } as unknown as LogSenseClient;

    const plugin = new ProcessPlugin(fakeClient);

    const listenersBefore = process.listenerCount("SIGTERM");
    plugin.install();
    const listenersAfterInstall = process.listenerCount("SIGTERM");
    plugin.uninstall();
    const listenersAfterUninstall = process.listenerCount("SIGTERM");

    assert(listenersAfterInstall === listenersBefore + 1, "SIGTERM listener added on install()");
    assert(listenersAfterUninstall === listenersBefore, "SIGTERM listener removed on uninstall()");

    // Installing twice should be idempotent
    plugin.install();
    plugin.install();
    const listenersAfterDoubleInstall = process.listenerCount("SIGTERM");
    assert(listenersAfterDoubleInstall === listenersBefore + 1, "Double install() is idempotent");
    plugin.uninstall();
}

/* ─────────────────────────────────────────────────────────────
 * Runner
 * ───────────────────────────────────────────────────────────── */

async function runAllTests(): Promise<void> {
    console.log("\n══════════════════════════════════════════════════");
    console.log("  LogSense V2 — Express Middleware Integration Tests");
    console.log("══════════════════════════════════════════════════");

    await testRequestLogging();
    await testResponseLogging();
    await testSlowRequestWarning();
    await testErrorHandlerLogging();
    await testRequestIdPropagation();
    await testExistingRequestIdRespected();
    await testXRequestIdResponseHeader();
    await testCustomMetadata();
    await testProcessPlugin();

    console.log("\n══════════════════════════════════════════════════");
    console.log(`  Results: ${passed} passed, ${failed} failed`);

    if (failures.length > 0) {
        console.error("\n  Failures:");
        failures.forEach((f) => console.error(`    • ${f}`));
        process.exit(1);
    } else {
        console.log("\n  ✅ All tests passed!");
        process.exit(0);
    }
}

runAllTests().catch((err) => {
    console.error("Unexpected test runner error:", err);
    process.exit(1);
});
