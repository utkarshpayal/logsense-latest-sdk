import http from "node:http";
import { logsense } from "../src/index";
import { EventCategory, EventStatus, Severity } from "../src/event/constants";
import fs from "node:fs/promises";
import path from "node:path";

const PORT = 18080;
const ENDPOINT = `http://localhost:${PORT}/events`;

interface ReceivedRequest {
    headers: http.IncomingHttpHeaders;
    body: string;
    events: any[];
}

async function runTests() {
    console.log("=== STARTING LOGSENSE SDK INTEGRATION TESTS ===");

    const receivedRequests: ReceivedRequest[] = [];
    let serverFailMode = false;

    // 1. Setup local mock HTTP server
    const server = http.createServer((req, res) => {
        if (serverFailMode) {
            res.writeHead(503, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Service Unavailable" }));
            return;
        }

        let body = "";
        req.on("data", (chunk) => {
            body += chunk.toString();
        });

        req.on("end", () => {
            let events: any[] = [];
            try {
                const parsed = JSON.parse(body);
                events = Array.isArray(parsed) ? parsed : (parsed.events || []);
            } catch (err) {
                // Not JSON or gzipped
            }
            receivedRequests.push({
                headers: req.headers,
                body,
                events,
            });
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ status: "success" }));
        });
    });

    await new Promise<void>((resolve) => server.listen(PORT, resolve));
    console.log(`[Mock Server] Listening on port ${PORT}`);

    try {
        // 2. Initialize SDK
        console.log("\n[Test 1] Initializing SDK...");
        const client = logsense.init({
            endpoint: ENDPOINT,
            apiKey: "test-api-key-12345",
            service: "verification-service",
            environment: "test",
            organizationId: "org-1",
            projectId: "proj-1",
            batchSize: 1, // Flush immediately for testing
            flushInterval: 100,
            debug: true,
            masking: {
                enabled: true,
                keys: ["password", "secretToken"],
            },
        });

        // 3. Verify Basic Tracking & Masking
        console.log("\n[Test 2] Tracking custom event with sensitive data...");
        await logsense.track({
            category: EventCategory.CUSTOM,
            type: "user.login",
            action: EventStatus.SUCCESS,
            severity: Severity.INFO,
            message: "User logged in",
            metadata: {
                username: "john_doe",
                password: "super-secret-password-123",
                secretToken: "jwt-token-abc",
            },
        });

        // Wait a brief moment for batch flush
        await new Promise((r) => setTimeout(r, 300));

        if (receivedRequests.length === 0) {
            throw new Error("No requests received by mock server");
        }

        const loginReq = receivedRequests.find((r) => r.events.some((e) => e.type === "user.login"));
        if (!loginReq) {
            throw new Error("No login request received by mock server");
        }
        const firstEvent = loginReq.events.find((e) => e.type === "user.login");
        console.log("Received Event Payload:", JSON.stringify(firstEvent, null, 2));

        // Assert masking worked
        if (firstEvent.metadata.password !== "[MASKED]") {
            throw new Error("Password field was not masked!");
        }
        if (firstEvent.metadata.secretToken !== "[MASKED]") {
            throw new Error("secretToken field was not masked!");
        }
        console.log("✓ Masking check passed successfully.");

        // 4. Verify Exception Capture Public API
        console.log("\n[Test 3] Capturing exception via API...");
        await logsense.captureException(new Error("Test Exception Capture"));
        await new Promise((r) => setTimeout(r, 300));

        const exceptionReq = receivedRequests.find((r) => r.events.some((e) => e.type === "exception"));
        if (!exceptionReq) {
            console.error("All received requests:", JSON.stringify(receivedRequests, null, 2));
            throw new Error("No exception request received by mock server");
        }
        const secondEvent = exceptionReq.events.find((e) => e.type === "exception");
        console.log("Captured Exception Event:", JSON.stringify(secondEvent, null, 2));

        if (secondEvent.category !== EventCategory.EXCEPTION || secondEvent.exception.name !== "Error") {
            throw new Error("Exception event was not formatted correctly");
        }
        console.log("✓ Exception capture check passed.");

        // 5. Verify Disk Queue and Retry Manager (offline mode)
        console.log("\n[Test 4] Testing Disk Queue persistence and retry recovery...");
        // Re-init client to enable disk queue
        await logsense.shutdown();
        receivedRequests.length = 0;

        // Clean any leftovers from old tests
        const queueDir = path.join(process.cwd(), ".logsense-test-queue");
        await fs.rm(queueDir, { recursive: true, force: true });

        const clientWithDisk = logsense.init({
            endpoint: ENDPOINT,
            apiKey: "test-api-key-12345",
            service: "verification-service",
            environment: "test",
            organizationId: "org-1",
            projectId: "proj-1",
            batchSize: 2, // Flush when 2 items are present
            flushInterval: 500,
            diskQueueEnabled: true,
            diskQueueDir: queueDir,
            retry: {
                maxAttempts: 3,
                backoffType: "fixed",
                baseDelayMs: 200,
                maxDelayMs: 1000,
            },
            debug: true,
        });

        // Fail the mock server to trigger queueing/retries
        serverFailMode = true;
        console.log("Set mock server to FAIL mode.");

        console.log("Tracking event while server is offline...");
        await logsense.track({
            category: EventCategory.CUSTOM,
            type: "offline.event.1",
            action: EventStatus.STARTED,
            severity: Severity.WARN,
            message: "This should be saved to disk queue",
        });

        // Shutdown the SDK to force pending retries back to disk queue
        console.log("Shutting down SDK to force pending retries back to disk queue...");
        await logsense.shutdown();

        // Check that queue directory was created and has files
        const files = await fs.readdir(queueDir);
        console.log(`Disk Queue directory contents:`, files);
        if (files.length === 0) {
            throw new Error("Disk queue directory is empty! Event was not saved to disk.");
        }
        console.log("✓ Disk queue persistence verified.");

        // Bring mock server back online
        serverFailMode = false;
        console.log("Set mock server to ONLINE mode.");

        // Re-initialize the SDK client to load and retry events from disk
        console.log("Re-initializing client to load events from disk queue...");
        const clientWithDiskReinit = logsense.init({
            endpoint: ENDPOINT,
            apiKey: "test-api-key-12345",
            service: "verification-service",
            environment: "test",
            organizationId: "org-1",
            projectId: "proj-1",
            batchSize: 1, // Flush immediately so we receive it
            flushInterval: 100,
            diskQueueEnabled: true,
            diskQueueDir: queueDir,
            debug: true,
        });

        // Wait for the next flush/retry cycle
        await new Promise((r) => setTimeout(r, 1200));

        const offlineReq = receivedRequests.find((r) => r.events.some((e) => e.type === "offline.event.1"));
        if (!offlineReq) {
            throw new Error("Events in disk queue were not re-sent and received by mock server");
        }
        const offlineEvent = offlineReq.events.find((e) => e.type === "offline.event.1");
        console.log("Received requests after server came back online:", receivedRequests.length);
        console.log("Recovered event body:", JSON.stringify(offlineEvent, null, 2));
        console.log("✓ Disk queue recovery and retry-manager verified.");

        // 6. Graceful shutdown verification
        console.log("\n[Test 5] Performing graceful shutdown...");
        await logsense.shutdown();
        console.log("✓ Graceful shutdown verified.");

        console.log("\n=== ALL INTEGRATION TESTS PASSED SUCCESSFULLY! ===");
    } catch (err) {
        console.error("\n❌ TEST FAILURE:", err);
        process.exitCode = 1;
    } finally {
        server.close();
        // Clean up disk queue test dir
        const queueDir = path.join(process.cwd(), ".logsense-test-queue");
        await fs.rm(queueDir, { recursive: true, force: true }).catch(() => {});
        console.log("[Mock Server] Stopped.");
    }
}

void runTests();
