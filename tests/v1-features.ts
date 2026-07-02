import assert from "node:assert";
import http from "node:http";
import { logsense } from "../src/index";
import { EventCategory, EventStatus, Severity } from "../src/event/constants";
import { SamplingProcessor } from "../src/pipeline/processors/sampling";
import { FingerprintGenerator } from "../src/fingerprinting/fingerprint";
import { contextStore } from "../src/context/context-store";
import { LogSensePlugin } from "../src/pipeline/plugin";

const PORT = 18081;
const ENDPOINT = `http://localhost:${PORT}/events`;

interface ReceivedRequest {
    headers: http.IncomingHttpHeaders;
    body: string;
    events: any[];
}

async function runV1Tests() {
    console.log("=== STARTING LOGSENSE SDK V1 FEATURE INTEGRATION TESTS ===");

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
                // Ignore
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
        // Initialize client
        console.log("\n[Test 1] Initializing SDK client...");
        const client = logsense.init({
            endpoint: ENDPOINT,
            apiKey: "v1-test-api-key",
            service: "v1-features-service",
            environment: "test",
            organizationId: "org-v1",
            projectId: "proj-v1",
            batchSize: 1, // Flush immediately
            flushInterval: 50,
            debug: true,
            sampling: {
                type: "fixed",
                rate: 1.0,
            },
        });

        // 2. Test Business Events Namespace API
        console.log("\n[Test 2] Tracking Business Events namespace methods...");
        await logsense.business.orderCreated("order_999", 149.99, "USD", { promoCode: "SUMMER26" });
        await logsense.business.paymentSucceeded("pay_777", 149.99, "USD");
        await logsense.business.userRegistered("user_888", "jane.doe@example.com");
        await logsense.business.subscriptionRenewed("sub_555", "pro-annual", 299.00);

        await new Promise((r) => setTimeout(r, 200));

        const businessReqs = receivedRequests.flatMap(r => r.events).filter(e => e.category === EventCategory.BUSINESS);
        assert.strictEqual(businessReqs.length, 4, "Should have captured 4 business events");

        const orderEvent = businessReqs.find(e => e.action === "order.created");
        assert.ok(orderEvent, "Order created event should exist");
        assert.strictEqual(orderEvent.metadata.orderId, "order_999", "Metadata orderId mismatch");
        assert.strictEqual(orderEvent.metadata.amount, 149.99, "Metadata amount mismatch");
        assert.strictEqual(orderEvent.metadata.promoCode, "SUMMER26", "Additional metadata mismatch");

        console.log("✓ Business Events APIs verified successfully.");

        // 3. Test Distributed Tracing Span Contexts
        console.log("\n[Test 3] Testing Tracing Span & context propagation...");
        await logsense.trace("parent-operation", async (parentSpan) => {
            parentSpan.setAttribute("env", "test-env");
            
            await logsense.trace("child-operation", async (childSpan) => {
                childSpan.setAttribute("db.query", "SELECT 1");
                await logsense.track({
                    category: EventCategory.CUSTOM,
                    type: "span.milestone",
                    action: EventStatus.SUCCESS,
                    severity: Severity.INFO,
                    message: "Inside nested child span",
                });
            });
        });

        await new Promise((r) => setTimeout(r, 200));

        const traceEvents = receivedRequests.flatMap(r => r.events);
        const nestedEvent = traceEvents.find(e => e.type === "span.milestone");
        assert.ok(nestedEvent, "Nested event should be captured");
        assert.ok(nestedEvent.relationships?.traceId, "TraceId should be present");
        assert.ok(nestedEvent.relationships?.spanId, "SpanId should be present");

        // Verify traceId propagation
        const parentSpanEvent = traceEvents.find(e => e.type === "span" && e.metadata?.spanName === "parent-operation");
        const childSpanEvent = traceEvents.find(e => e.type === "span" && e.metadata?.spanName === "child-operation");

        assert.ok(parentSpanEvent, "Parent span event should exist");
        assert.ok(childSpanEvent, "Child span event should exist");
        assert.strictEqual(parentSpanEvent.relationships?.traceId, childSpanEvent.relationships?.traceId, "TraceId should be identical");
        assert.strictEqual(childSpanEvent.relationships?.parentEventId, parentSpanEvent.relationships?.spanId, "Child parentEventId should match parent spanId");

        console.log("✓ Tracing Context propagation verified.");

        // 4. Test Session & Identity APIs
        console.log("\n[Test 4] Testing Session & Identity APIs...");
        await contextStore.run({
            requestId: "req-123",
            traceId: "trace-123",
            tenant: {
                organizationId: "org-v1",
                projectId: "proj-v1",
                environment: "test" as any,
                service: "v1-features-service",
            },
            startTime: Date.now(),
            requestNumber: 1,
            metadata: {},
        }, async () => {
            logsense.identify("user-user-123");
            logsense.setUser({ id: "user-user-123", email: "user@example.com" });
            logsense.setOrganization("org-special");
            logsense.setWorkspace("ws-test");

            await logsense.track({
                category: EventCategory.CUSTOM,
                type: "identity.test",
                action: EventStatus.SUCCESS,
                severity: Severity.INFO,
                message: "User with specific identity",
            });
        });

        await new Promise((r) => setTimeout(r, 200));

        const identityEvents = receivedRequests.flatMap(r => r.events);
        const identifiedEvent = identityEvents.find(e => e.type === "identity.test");
        assert.ok(identifiedEvent, "Identified event should be captured");
        assert.strictEqual(identifiedEvent.actor?.id, "user-user-123", "Actor ID mismatch");
        assert.strictEqual(identifiedEvent.actor?.email, "user@example.com", "Actor email mismatch");
        assert.strictEqual(identifiedEvent.tenant?.organizationId, "org-special", "Tenant orgId mismatch");
        assert.strictEqual(identifiedEvent.tenant?.projectId, "ws-test", "Tenant projectId mismatch");

        // Test clearIdentity
        await contextStore.run({
            requestId: "req-456",
            traceId: "trace-456",
            tenant: {
                organizationId: "org-v1",
                projectId: "proj-v1",
                environment: "test" as any,
                service: "v1-features-service",
            },
            startTime: Date.now(),
            requestNumber: 2,
            metadata: {},
        }, async () => {
            logsense.identify("user-user-123");
            logsense.clearIdentity();
            await logsense.track({
                category: EventCategory.CUSTOM,
                type: "identity.cleared",
                action: EventStatus.SUCCESS,
                severity: Severity.INFO,
                message: "Anonymous request",
            });
        });

        await new Promise((r) => setTimeout(r, 200));
        const clearedEvents = receivedRequests.flatMap(r => r.events);
        const anonymousEvent = clearedEvents.find(e => e.type === "identity.cleared");
        assert.ok(anonymousEvent, "Anonymous event should be captured");
        assert.strictEqual(anonymousEvent.actor?.id, undefined, "Actor ID should be cleared");

        console.log("✓ Session & Identity APIs verified.");

        // 5. Test Fingerprint Generator
        console.log("\n[Test 5] Testing Fingerprint Generator...");
        const error1 = new Error("Unique network error to server A");
        error1.stack = "Error: Unique network error\n    at Object.test (file.js:10:20)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)";
        
        const error2 = new Error("Unique network error to server A");
        error2.stack = "Error: Unique network error\n    at Object.test (file.js:15:30)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)";

        const event1 = {
            category: EventCategory.EXCEPTION,
            exception: { name: error1.name, message: error1.message, stack: error1.stack }
        };
        const event2 = {
            category: EventCategory.EXCEPTION,
            exception: { name: error2.name, message: error2.message, stack: error2.stack }
        };

        const fingerprint1 = FingerprintGenerator.generate(event1 as any);
        const fingerprint2 = FingerprintGenerator.generate(event2 as any);

        assert.strictEqual(fingerprint1, fingerprint2, "Fingerprints must be stable across shifted line/column numbers in stack trace");

        // Database SQL error normalization
        const dbEvent1 = {
            category: EventCategory.DATABASE,
            database: { provider: "postgresql", operation: "select", table: "users", success: false, query: "SELECT * FROM users WHERE id = 123 AND name = 'John'" }
        };
        const dbEvent2 = {
            category: EventCategory.DATABASE,
            database: { provider: "postgresql", operation: "select", table: "users", success: false, query: "SELECT * FROM users WHERE id = 456 AND name = 'Jane'" }
        };

        const dbFingerprint1 = FingerprintGenerator.generate(dbEvent1 as any);
        const dbFingerprint2 = FingerprintGenerator.generate(dbEvent2 as any);
        assert.strictEqual(dbFingerprint1, dbFingerprint2, "Database SQL fingerprints must normalize string/number literals");

        console.log("✓ Fingerprint Generator stable hashing verified.");

        // 6. Test Sampling Strategies
        console.log("\n[Test 6] Testing Sampler Strategies...");
        
        // Fixed Strategy
        const fixedSampler = new SamplingProcessor({ strategy: "fixed", rate: 0.0 });
        const sampledOutEvent = fixedSampler.process({ category: EventCategory.CUSTOM, type: "test" } as any);
        assert.strictEqual(sampledOutEvent, null, "Rate 0.0 fixed sampler should drop events");

        // Error-First Strategy (keeps exceptions, drops custom)
        const errorFirstSampler = new SamplingProcessor({ strategy: "error-first", rate: 0.0 });
        const keptException = errorFirstSampler.process({ category: EventCategory.EXCEPTION, severity: Severity.ERROR, message: "an error" } as any);
        const droppedCustom = errorFirstSampler.process({ category: EventCategory.CUSTOM, severity: Severity.INFO, message: "custom info" } as any);
        assert.ok(keptException, "Error-first sampler must keep exceptions even with rate 0.0");
        assert.strictEqual(droppedCustom, null, "Error-first sampler must drop normal logs if rate is 0.0");

        // Slow-First Strategy
        const slowFirstSampler = new SamplingProcessor({ strategy: "slow-first", rate: 0.0, slowThresholdMs: 200 });
        const keptSlowEvent = slowFirstSampler.process({ category: EventCategory.CUSTOM, duration: 300, message: "slow transaction" } as any);
        const droppedFastEvent = slowFirstSampler.process({ category: EventCategory.CUSTOM, duration: 50, message: "fast transaction" } as any);
        assert.ok(keptSlowEvent, "Slow-first sampler must keep slow events (duration > threshold)");
        assert.strictEqual(droppedFastEvent, null, "Slow-first sampler must drop fast events if rate is 0.0");

        // Adaptive Strategy (scales down when load is high)
        const adaptiveSampler = new SamplingProcessor({ strategy: "adaptive", rate: 1.0, windowSizeMs: 50, maxEventsPerWindow: 2 });
        // Process multiple events to trigger rate reduction
        adaptiveSampler.process({} as any);
        adaptiveSampler.process({} as any);
        adaptiveSampler.process({} as any);
        adaptiveSampler.process({} as any);

        // Wait for window to elapse so rate adjusts
        await new Promise(r => setTimeout(r, 60));
        // Next process triggers adjustment
        adaptiveSampler.process({} as any);
        
        // Retrieve internal adaptiveRate
        const currentRate = (adaptiveSampler as any).adaptiveRate;
        assert.ok(currentRate < 1.0, "Adaptive sampler rate should scale down under high load");

        console.log("✓ Sampler Strategies verified successfully.");

        // 7. Test Plugin Lifecycle Hooks
        console.log("\n[Test 7] Testing Plugin Lifecycle Hooks...");
        const invokedHooks: string[] = [];
        const testPlugin: LogSensePlugin = {
            name: "test-lifecycle-plugin",
            beforeBuild(partial) {
                invokedHooks.push("beforeBuild");
                partial.message = (partial.message || "") + " [Enriched]";
                return partial;
            },
            afterBuild(event) {
                invokedHooks.push("afterBuild");
                return event;
            },
            beforeQueue(event) {
                invokedHooks.push("beforeQueue");
                return event;
            },
            afterQueue(event) {
                invokedHooks.push("afterQueue");
            },
            beforeTransport(batch) {
                invokedHooks.push("beforeTransport");
                return batch;
            },
            afterTransport(batch, result) {
                invokedHooks.push("afterTransport");
            },
            onShutdown() {
                invokedHooks.push("onShutdown");
            }
        };

        logsense.use(testPlugin);

        await logsense.track({
            category: EventCategory.CUSTOM,
            type: "plugin.lifecycle.test",
            action: EventStatus.SUCCESS,
            severity: Severity.INFO,
            message: "Testing plugin hooks",
        });

        await new Promise((r) => setTimeout(r, 200));

        // Verify lifecycle order and presence
        assert.ok(invokedHooks.includes("beforeBuild"), "beforeBuild hook not run");
        assert.ok(invokedHooks.includes("afterBuild"), "afterBuild hook not run");
        assert.ok(invokedHooks.includes("beforeQueue"), "beforeQueue hook not run");
        assert.ok(invokedHooks.includes("afterQueue"), "afterQueue hook not run");
        assert.ok(invokedHooks.includes("beforeTransport"), "beforeTransport hook not run");
        assert.ok(invokedHooks.includes("afterTransport"), "afterTransport hook not run");

        const pluginReq = receivedRequests.flatMap(r => r.events).find(e => e.type === "plugin.lifecycle.test");
        assert.ok(pluginReq, "Lifecycle test event was not transmitted");
        assert.ok(pluginReq.message.includes("[Enriched]"), "beforeBuild enrichment did not modify event message");

        console.log("✓ Plugin lifecycle hooks executed successfully.");

        // 8. Test Metrics and Health checks
        console.log("\n[Test 8] Testing Metrics & Health check endpoints...");
        const metrics = logsense.metrics();
        const health = logsense.health();

        assert.ok(metrics, "Metrics should be returned");
        assert.ok(metrics.queueSize !== undefined, "metrics.queueSize missing");
        assert.ok(metrics.eventsPerSecond !== undefined, "metrics.eventsPerSecond missing");
        assert.ok(metrics.averageLatency !== undefined, "metrics.averageLatency missing");

        assert.ok(health, "Health check status should be returned");
        assert.strictEqual(health.status, "healthy", "Health should be reported as healthy");
        assert.ok(health.transport.successCount > 0, "Transport successes should be recorded");
        assert.ok(health.runtime.memory, "Runtime memory usage details missing");

        console.log("✓ Metrics & Health API validated.");

        // Shutdown Client
        console.log("\nShutting down client...");
        await logsense.shutdown();
        
        assert.ok(invokedHooks.includes("onShutdown"), "onShutdown hook was not run");
        console.log("✓ shutdown plugin hook run.");

        console.log("\n=== ALL V1 FEATURE INTEGRATION TESTS PASSED SUCCESSFULLY! ===");
    } catch (err) {
        console.error("\n❌ TEST FAILURE:", err);
        process.exitCode = 1;
    } finally {
        server.close();
        console.log("[Mock Server] Stopped.");
    }
}

void runV1Tests();
