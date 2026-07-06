import http from "node:http";
import { HttpServerInstrumentation } from "../src/instrumentation/http-instrumentation.js";
import type { TenantContext } from "../src/event/types.js";
import {Environment} from "../src/event/constants.js";

function assert(condition: boolean, message: string): void {
    if (!condition) {
        throw new Error(message);
    }
}

async function run() {
    const collected: any[] = [];

    const fakeCollector = {
        collect: async (event: any) => {
            collected.push(event);
            return event;
        },
    } as any;

    const tenant: TenantContext = {
        organizationId: "test-org",
        projectId: "test-project",
        environment: Environment.TEST,
        service: "test-service",
    };

    const instrumentation = new HttpServerInstrumentation({
        collector: fakeCollector,
        tenant,
        debug: false,
    });

    instrumentation.register();

    const server = http.createServer((req, res) => {
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("ok");
    });

    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as { port: number }).port;

    await new Promise<void>((resolve, reject) => {
        const req = http.request({ hostname: "127.0.0.1", port, path: "/ping", method: "GET" }, (res) => {
            res.on("data", () => {
                // drain
            });
            res.on("end", () => resolve());
        });
        req.on("error", reject);
        req.end();
    });

    await new Promise((resolve) => setTimeout(resolve, 100));

    instrumentation.unregister();
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));

    const started = collected.filter((evt) => evt.type === "request.started");
    const finished = collected.filter((evt) => evt.type === "request.finished");
    const failed = collected.filter((evt) => evt.type === "request.failed");

    assert(started.length === 1, `Expected 1 request.started event, got ${started.length}`);
    assert(finished.length === 1, `Expected 1 request.finished event, got ${finished.length}`);
    assert(failed.length === 0, `Expected no request.failed events, got ${failed.length}`);

    const startEvent = started[0];
    const finishEvent = finished[0];

    assert(startEvent.type === "request.started", "First event is request.started");
    assert(finishEvent.type === "request.finished", "Second event is request.finished");
    assert(typeof finishEvent.duration === "number", "request.finished includes duration");
    assert(startEvent.http?.method === "GET", "request.started records HTTP method");
    assert(finishEvent.http?.statusCode === 200, "request.finished records statusCode");

    console.log("✅ HTTP instrumentation test passed: exactly one request.started and one request.finished emitted per request.");
}

run().catch((err) => {
    console.error(err);
    process.exit(1);
});
