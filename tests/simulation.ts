import http from "node:http";
import { logsense } from "../src/index";
import { wrapRedisClient } from "../src/instrumentation/redis-instrumentation";
import { prismaLogSenseExtension } from "../src/instrumentation/db-instrumentation";
import { EventCategory } from "../src/event/constants";

const INGEST_PORT = 19090;
const APP_PORT = 19091;

// 1. A local ingest mock server to inspect the generated observability events
const receivedEvents: any[] = [];
const ingestServer = http.createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => { body += chunk.toString(); });
    req.on("end", () => {
        try {
            const parsed = JSON.parse(body);
            const events = Array.isArray(parsed) ? parsed : (parsed.events || []);
            receivedEvents.push(...events);
        } catch {}
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "success" }));
    });
});

// 2. Mock Redis Client class
class MockRedisClient {
    private cache = new Map<string, string>();

    async get(key: string): Promise<string | null> {
        // Simulate delay
        await new Promise((r) => setTimeout(r, 10));
        return this.cache.get(key) || null;
    }

    async set(key: string, value: string): Promise<string> {
        await new Promise((r) => setTimeout(r, 10));
        this.cache.set(key, value);
        return "OK";
    }
}

// 3. Mock Prisma Client class
class MockPrismaClient {
    // Standard mock structure matching Prisma $extends query mechanism
    private queryHandlers: any[] = [];

    $extends(extension: any) {
        if (typeof extension === "function") {
            return extension(this);
        }
        if (extension.query) {
            this.queryHandlers.push(extension.query);
        }
        return this;
    }

    async executeQuery(model: string, operation: string, args: any, originalQueryFn: () => Promise<any>) {
        let runner = originalQueryFn;
        // Apply registered extensions
        for (const handler of this.queryHandlers) {
            if (handler.$allOperations) {
                const prev = runner;
                runner = () => handler.$allOperations({
                    model,
                    operation,
                    args,
                    query: prev
                });
            }
        }
        return runner();
    }
}

async function runSimulation() {
    await new Promise<void>((resolve) => ingestServer.listen(INGEST_PORT, resolve));
    console.log(`[Ingest Mock] Listening on port ${INGEST_PORT} for SDK telemetry...`);

    // Initialize LogSense SDK
    console.log("\n[LogSense] Initializing Client...");
    const client = logsense.init({
        endpoint: `http://localhost:${INGEST_PORT}/events`,
        apiKey: "sim-api-key",
        service: "users-service",
        environment: "production",
        organizationId: "org-demo",
        projectId: "proj-demo",
        batchSize: 1, // Flush instantly so we can see events immediately
        flushInterval: 50,
        debug: false, // Turn off SDK internal debug logs to focus on simulation output
    });

    // Instrument Redis
    const redisClient = new MockRedisClient();
    wrapRedisClient(redisClient, client.collector);
    console.log("✓ Redis Client Instrumented");

    // Instrument Database (Prisma)
    const rawPrisma = new MockPrismaClient();
    const prisma = rawPrisma.$extends(prismaLogSenseExtension(client.collector, "postgres" as any));
    console.log("✓ Prisma Client Instrumented");

    // 4. Create actual Application Server (simulates Express/Fastify routes)
    const appServer = http.createServer(async (req, res) => {
        const url = req.url || "/";
        console.log(`\n[App Server] Incoming request: ${req.method} ${url}`);

        if (url === "/users/123" && req.method === "GET") {
            try {
                // Step A: Check Redis Cache (Simulates cache.operation telemetry)
                console.log(" -> Checking Redis Cache...");
                const cachedUser = await redisClient.get("user:123");

                if (cachedUser) {
                    console.log(" -> Redis HIT! Returning cached result.");
                    res.writeHead(200, { "Content-Type": "application/json" });
                    res.end(cachedUser);
                    return;
                }

                console.log(" -> Redis MISS! Querying Database...");
                // Step B: Query Database (Simulates db.query telemetry)
                const dbUser = await prisma.executeQuery("User", "findUnique", { where: { id: 123 } }, async () => {
                    await new Promise((r) => setTimeout(r, 25)); // Simulate DB latency
                    return { id: 123, name: "Alice Smith", email: "alice@example.com" };
                });

                // Step C: Set Cache in Redis (Simulates cache.operation telemetry)
                console.log(" -> Caching result in Redis...");
                await redisClient.set("user:123", JSON.stringify(dbUser));

                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify(dbUser));
            } catch (err) {
                res.writeHead(500);
                res.end("Internal Error");
            }
        } else if (url === "/users" && req.method === "POST") {
            try {
                console.log(" -> Attempting invalid database operation...");
                // Step D: Query DB that throws error (Simulates failed db.query telemetry)
                await prisma.executeQuery("User", "create", { data: { email: "invalid-email" } }, async () => {
                    await new Promise((r) => setTimeout(r, 15));
                    throw new Error("Unique constraint violation on email field");
                });
                res.writeHead(201);
                res.end("Created");
            } catch (err: any) {
                console.log(` -> DB Error caught: ${err.message}. Capturing exception...`);
                // Captures standard exceptions via public API
                await logsense.captureException(err);
                res.writeHead(500, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: err.message }));
            }
        } else {
            res.writeHead(404);
            res.end("Not Found");
        }
    });

    await new Promise<void>((resolve) => appServer.listen(APP_PORT, resolve));
    console.log(`[App Server] Running on http://localhost:${APP_PORT}`);

    // Helper helper to execute an HTTP request to our server
    const makeRequest = (method: string, path: string) => {
        return new Promise<void>((resolve) => {
            const req = http.request({
                hostname: "localhost",
                port: APP_PORT,
                path,
                method,
                headers: {
                    "x-request-id": `req-id-${Math.random().toString(36).substring(7)}`,
                    "x-trace-id": `trace-id-${Math.random().toString(36).substring(7)}`,
                }
            }, (res) => {
                res.on("data", () => {});
                res.on("end", () => resolve());
            });
            req.end();
        });
    };

    // 5. Fire simulated requests
    console.log("\n--- TRIGGERING REQUEST 1: Cache Miss -> DB Query -> Cache Populate ---");
    await makeRequest("GET", "/users/123");

    console.log("\n--- TRIGGERING REQUEST 2: Cache Hit ---");
    await makeRequest("GET", "/users/123");

    console.log("\n--- TRIGGERING REQUEST 3: Database Exception/Failure ---");
    await makeRequest("POST", "/users");

    // Wait for all SDK events to flush to the Ingest Mock Server
    await new Promise((r) => setTimeout(r, 500));

    // 6. Print trace relationships & events collected
    console.log("\n==================================================================");
    console.log("LOGSENSE SDK TELEMETRY SIMULATION RESULTS");
    console.log("==================================================================");
    console.log(`Total events captured: ${receivedEvents.length}`);
    console.log("RAW EVENTS:", JSON.stringify(receivedEvents, null, 2));

    // Group events by requestId to demonstrate trace trees
    const traces = new Map<string, any[]>();
    for (const event of receivedEvents) {
        const reqId = event.relationships?.requestId || "global/background";
        if (!traces.has(reqId)) {
            traces.set(reqId, []);
        }
        traces.get(reqId)!.push(event);
    }

    for (const [reqId, events] of traces.entries()) {
        console.log(`\nTrace Tree for Request ID: ${reqId}`);
        // Sort chronologically
        events.sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

        events.forEach((e: any) => {
            const timeStr = new Date(e.timestamp).toLocaleTimeString();
            const parentSpanStr = e.relationships?.parentEventId ? ` [Parent ID: ${e.relationships.parentEventId.substring(0, 8)}...]` : "";
            const eventIdStr = `[Event ID: ${e.relationships?.eventId?.substring(0, 8)}...]`;

            if (e.category === "http") {
                console.log(`  ├── [${timeStr}] HTTP ${e.http?.method} ${e.http?.url} -> Status: ${e.action.toUpperCase()} ${eventIdStr}${parentSpanStr}`);
            } else if (e.category === "cache") {
                console.log(`  │    ├── [${timeStr}] REDIS ${e.cache?.operation} key="${e.cache?.key}" -> ${e.message} ${eventIdStr}${parentSpanStr}`);
            } else if (e.category === "database") {
                console.log(`  │    ├── [${timeStr}] PRISMA ${e.database?.operation} on "${e.database?.table}" -> Status: ${e.action.toUpperCase()} ${eventIdStr}${parentSpanStr}`);
            } else if (e.category === "exception") {
                console.log(`  │    └── [${timeStr}] EXCEPTION CAPTURED: ${e.exception?.message} ${eventIdStr}${parentSpanStr}`);
            } else if (e.category === "runtime") {
                // Ignore runtime metrics in trace trees to keep it readable
            } else {
                console.log(`  ├── [${timeStr}] ${e.category.toUpperCase()}: ${e.message} ${eventIdStr}${parentSpanStr}`);
            }
        });
    }

    // Clean up
    console.log("\nStopping servers...");
    appServer.close();
    ingestServer.close();
    await logsense.shutdown();
    console.log("Done.");
}

void runSimulation();
