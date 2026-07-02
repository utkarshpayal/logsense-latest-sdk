/**
 * LogSense V2 — Live Demo App
 *
 * Ek real Express server jo logsenseMiddleware use karta hai.
 * Logs ek local mock ingest server par jaate hain aur console pe print hote hain.
 *
 * Run karo:
 *   npx tsx tests/demo-app.ts
 *
 * Phir alag terminal mein:
 *   curl http://localhost:3000/
 *   curl http://localhost:3000/user/42
 *   curl http://localhost:3000/slow
 *   curl http://localhost:3000/boom
 *   curl http://localhost:3000/pay -X POST -H "Content-Type: application/json" -d '{"amount":500}'
 *   curl http://localhost:3000/ -H "X-Request-ID: my-custom-id-999"
 */

import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import express, { Request, Response, NextFunction } from "express";
import { LogSenseClient } from "../src/core/sdk.js";
import { logsenseMiddleware } from "../src/middleware/express.js";
import { ProcessPlugin } from "../src/plugins/process.js";
import { DatabaseOperation, DatabaseType, EventCategory, EventStatus, Severity } from "../src/event/constants.js";
import { contextStore } from "../src/context/context-store.js";

/* ─────────────────────────────────────────────────────────────
 * 1. Local mock ingest server
 *    Receives batched events from the SDK and pretty-prints them.
 * ───────────────────────────────────────────────────────────── */

const INGEST_PORT = 19099;
const APP_PORT    = 3000;

// Log output directory — created next to this file
const LOG_DIR      = path.join(import.meta.dirname, "logs");
const JSON_LOG     = path.join(LOG_DIR, "events.json");   // NDJSON (one event per line)
const TEXT_LOG     = path.join(LOG_DIR, "events.log");    // Human-readable

if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

function appendJsonLog(events: any[]): void {
    const lines = events.map((e) => JSON.stringify(e)).join("\n") + "\n";
    fs.appendFileSync(JSON_LOG, lines, "utf8");
}

function appendTextLog(events: any[]): void {
    const lines = events.map((e) => {
        const ts       = e.timestamp ?? new Date().toISOString();
        const level    = (e.severity ?? "info").toUpperCase().padEnd(5);
        const msg      = e.message ?? "(no message)";
        const meta     = e.metadata ?? {};
        const metaStr  = Object.keys(meta).length
            ? " | " + Object.entries(meta)
                .filter(([k]) => ["requestId","method","path","statusCode","durationMs","event","errorName","signal"].includes(k))
                .map(([k, v]) => `${k}=${v}`)
                .join(" ")
            : "";
        return `[${ts}] [${level}] ${msg}${metaStr}`;
    }).join("\n") + "\n";
    fs.appendFileSync(TEXT_LOG, lines, "utf8");
}

const ingestServer = http.createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => { body += chunk.toString(); });
    req.on("end", () => {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok" }));

        try {
            const parsed = JSON.parse(body);
            const events: any[] = Array.isArray(parsed) ? parsed : (parsed.events ?? []);
            if (events.length === 0) return;

            // ── Persist to files ──────────────────────────────────
            appendJsonLog(events);   // logs/events.json  (NDJSON)
            appendTextLog(events);   // logs/events.log   (readable)

            // ── Print to console ──────────────────────────────────
            console.log(`\n${"─".repeat(60)}`);
            console.log(`📦 [LogSense Ingest] Received ${events.length} event(s)`);
            console.log(`   📄 Saved → ${JSON_LOG}`);
            console.log(`   📄 Saved → ${TEXT_LOG}`);
            console.log("─".repeat(60));

            for (const event of events) {
                const level    = (event.severity ?? "info").toUpperCase().padEnd(5);
                const msg      = event.message ?? "(no message)";
                const meta     = event.metadata ?? {};
                const isDb     = event.category === "database";
                const isHttp   = event.category === "http" || (event.type === "request.incoming" || event.type === "request.completed");

                const color =
                    level.trim() === "ERROR" || level.trim() === "FATAL" ? "\x1b[31m" :
                    level.trim() === "WARN"  ? "\x1b[33m" :
                    level.trim() === "INFO"  ? "\x1b[36m" : "\x1b[90m";
                const reset  = "\x1b[0m";
                const icon   = isDb ? "🗄️ " : isHttp ? "🌐 " : "📝 ";

                console.log(`${color}[${level}]${reset} ${icon}${msg}`);

                // HTTP metadata
                const httpKeys = ["requestId", "method", "path", "statusCode", "durationMs", "ip", "errorName", "event", "signal"];
                const interesting: Record<string, unknown> = {};
                for (const k of httpKeys) {
                    if (meta[k] !== undefined) interesting[k] = meta[k];
                }
                if (Object.keys(interesting).length > 0) {
                    console.log("        ", JSON.stringify(interesting));
                }

                // DB-specific metadata
                if (isDb && event.database) {
                    const db = event.database;
                    console.log(`         provider=${db.provider} op=${db.operation} table=${db.table ?? db.collection ?? "?"} success=${db.success} duration=${event.duration ?? 0}ms`);
                    if (db.query) console.log(`         query: ${String(db.query).substring(0, 120)}`);
                }
            }
            console.log("─".repeat(60));
        } catch {
            // Ignore malformed body
        }
    });
});

ingestServer.listen(INGEST_PORT, () => {
    console.log(`\n✅ Mock ingest server listening on http://localhost:${INGEST_PORT}`);
});

/* ─────────────────────────────────────────────────────────────
 * 2. Initialize LogSense SDK
 * ───────────────────────────────────────────────────────────── */

const sdk = new LogSenseClient({
    apiKey:         "demo-api-key",
    service:        "payment-api",
    environment:    "development",
    organizationId: "demo-org",
    projectId:      "demo-project",
    endpoint:       `http://localhost:${INGEST_PORT}/v1/events`,
    flushInterval:  500,
    batchSize:      5,
    debug:          false,
    disableInstrumentation: true,
});

/* ─────────────────────────────────────────────────────────────
 * Simulated DB layer
 * Fires real collector.collect() events — exactly like wrapPg.
 * No real DB needed for the demo.
 * ───────────────────────────────────────────────────────────── */

async function fakeQuery(
    sql: string,
    table: string,
    operation: DatabaseOperation,
    simulatedDelayMs = 10,
    shouldFail = false,
): Promise<{ rows: any[]; rowCount: number }> {
    const start = Date.now();

    // Simulate network + query latency
    await new Promise((r) => setTimeout(r, simulatedDelayMs));

    const duration = Date.now() - start;

    // Pick up AsyncLocalStorage context so requestId/traceId appear on DB events
    const activeCtx = contextStore.get();
    const relationships: any = activeCtx
        ? {
              traceId:   activeCtx.traceId,
              requestId: activeCtx.requestId,
              ...(activeCtx.spanId    ? { spanId:    activeCtx.spanId    } : {}),
              ...(activeCtx.sessionId ? { sessionId: activeCtx.sessionId } : {}),
          }
        : undefined;

    if (shouldFail) {
        void sdk.collector.collect<any>({
            category:  EventCategory.DATABASE,
            type:      "db.query",
            action:    EventStatus.FAILED,
            severity:  Severity.ERROR,
            message:   `PG query ${operation} failed: connection refused`,
            duration,
            relationships,
            database: { provider: DatabaseType.POSTGRES, operation, table, success: false, query: sql },
        });
        throw new Error("DB connection refused (simulated)");
    }

    void sdk.collector.collect<any>({
        category:  EventCategory.DATABASE,
        type:      "db.query",
        action:    EventStatus.COMPLETED,
        severity:  Severity.INFO,
        message:   `PG query ${operation} succeeded`,
        duration,
        relationships,
        database: { provider: DatabaseType.POSTGRES, operation, table, success: true, query: sql },
    });

    // Return fake rows
    return { rows: [{ id: 1, name: "Alice", email: "alice@example.com" }], rowCount: 1 };
}

/* ─────────────────────────────────────────────────────────────
 * 3. Express app
 * ───────────────────────────────────────────────────────────── */

const app = express();
app.use(express.json());

// Mount middleware — returns [requestHandler, errorHandler]
const [logRequests, logErrors] = logsenseMiddleware(sdk, {
    slowThresholdMs: 300,                          // warn if > 300ms
    metadata: { version: "2.0.0", region: "ap-south-1" }, // merged into every log
});

app.use(logRequests); // ← must be FIRST

/* ── Routes ─────────────────────────────────────────────────── */

// Normal route
app.get("/", (req: Request, res: Response) => {
    const { requestId } = req.logsense;
    sdk.logger.info("Home route hit", { requestId, user: "guest" });
    res.json({ message: "Hello from LogSense demo!", requestId });
});

// GET /user/:id — SELECT query
app.get("/user/:id", async (req: Request, res: Response, next: NextFunction) => {
    const { requestId } = req.logsense;
    const { id } = req.params;

    try {
        const result = await fakeQuery(
            `SELECT * FROM users WHERE id = ${id}`,
            "users",
            DatabaseOperation.SELECT,
            15, // 15ms simulated latency
        );
        sdk.logger.info(`User ${id} fetched from DB`, { requestId, userId: id, rowCount: result.rowCount });
        res.json({ userId: id, user: result.rows[0], requestId });
    } catch (err) {
        next(err);
    }
});

// DELETE /user/:id — DELETE query
app.delete("/user/:id", async (req: Request, res: Response, next: NextFunction) => {
    const { requestId } = req.logsense;
    const { id } = req.params;

    try {
        await fakeQuery(
            `DELETE FROM users WHERE id = ${id}`,
            "users",
            DatabaseOperation.DELETE,
            8,
        );
        sdk.logger.info(`User ${id} deleted`, { requestId, userId: id });
        res.json({ deleted: true, userId: id, requestId });
    } catch (err) {
        next(err);
    }
});

// GET /db-error — simulates a DB failure
app.get("/db-error", async (_req: Request, _res: Response, next: NextFunction) => {
    try {
        await fakeQuery("SELECT * FROM payments", "payments", DatabaseOperation.SELECT, 5, true);
    } catch (err) {
        next(err);
    }
});

// POST /pay — INSERT payment + UPDATE balance
app.post("/pay", async (req: Request, res: Response, next: NextFunction) => {
    const { requestId } = req.logsense;
    const { amount } = req.body as { amount?: number };

    try {
        // 1. INSERT into payments
        await fakeQuery(
            `INSERT INTO payments (amount, status) VALUES (${amount ?? 0}, 'pending')`,
            "payments",
            DatabaseOperation.INSERT,
            12,
        );

        // 2. UPDATE user balance
        await fakeQuery(
            `UPDATE users SET balance = balance - ${amount ?? 0} WHERE id = 1`,
            "users",
            DatabaseOperation.UPDATE,
            8,
        );

        sdk.logger.info("Payment processed", { requestId, amount: amount ?? 0 });
        res.status(201).json({ status: "queued", requestId });
    } catch (err) {
        next(err);
    }
});

// Slow route — will trigger WARN log
app.get("/slow", (_req: Request, res: Response) => {
    setTimeout(() => res.json({ done: true }), 500); // 500ms > 300ms threshold
});

// Error route — will trigger ERROR log
app.get("/boom", (_req: Request, _res: Response) => {
    throw new Error("Kaboom! Something exploded.");
});

// 404 fallback
app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: "Route not found" });
});

app.use(logErrors); // ← must be LAST

/* ─────────────────────────────────────────────────────────────
 * 4. Start app + ProcessPlugin
 * ───────────────────────────────────────────────────────────── */

const processPlugin = new ProcessPlugin(sdk, { exitCode: 0 });
processPlugin.install();

app.listen(APP_PORT, () => {
    console.log(`\n🚀 Demo app running on http://localhost:${APP_PORT}`);
    console.log(`\nTry these curl commands in another terminal:\n`);
    console.log(`  # HTTP logs`);
    console.log(`  curl http://localhost:${APP_PORT}/`);
    console.log(`  curl http://localhost:${APP_PORT}/slow`);
    console.log(`  curl http://localhost:${APP_PORT}/boom`);
    console.log(`  curl http://localhost:${APP_PORT}/ -H "X-Request-ID: my-custom-id-999"`);
    console.log(`\n  # DB query logs (SELECT)`);
    console.log(`  curl http://localhost:${APP_PORT}/user/42`);
    console.log(`\n  # DB query logs (INSERT + UPDATE)`);
    console.log(`  curl http://localhost:${APP_PORT}/pay -X POST -H "Content-Type: application/json" -d '{"amount":500}'`);
    console.log(`\n  # DB query logs (DELETE)`);
    console.log(`  curl -X DELETE http://localhost:${APP_PORT}/user/42`);
    console.log(`\n  # DB ERROR log`);
    console.log(`  curl http://localhost:${APP_PORT}/db-error`);
    console.log(`\nPress Ctrl+C to stop.\n`);
});
