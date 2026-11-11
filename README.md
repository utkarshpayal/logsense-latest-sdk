# LogSense Node.js SDK (`@utkarshpayal/logsense-sdk`)

Automatic observability for Node.js applications. The SDK collects structured events (logs, HTTP
requests, outbound HTTP calls, exceptions, runtime metrics, database/cache operations and business
events), runs them through a processing pipeline (enrichment, masking, fingerprinting, sampling) and
ships them in batches to a LogSense server, with retries, an optional disk-backed queue and a dead-letter queue.

This is the v2 SDK (package version `2.0.5`). Detailed guides live in [`docs/`](docs/SUMMARY.md).

---

## Features

- **Automatic instrumentation** (unless `disableInstrumentation` is set): incoming HTTP server requests, outbound HTTP client calls, uncaught exceptions / unhandled rejections, and periodic runtime (memory/CPU) metrics.
- **Express middleware** (`@utkarshpayal/logsense-sdk/express`) that assigns a request ID (`X-Request-ID`), resolves a trace ID (`x-trace-id` header or the request ID), propagates context through `AsyncLocalStorage`, and logs unhandled route errors.
- **Database / cache helpers**: `wrapPg`, `wrapMysql2`, `prismaLogSenseExtension`, `mongooseLogSensePlugin`, `wrapRedisClient`.
- **Structured logger** with `trace`, `debug`, `info`, `warn`, `error`, `fatal`.
- **Global API** (`logsense`) for exceptions, spans, user/organization identity, sessions, business and onboarding events, metrics and health.
- **Pipeline processors**: enrichment (region, git SHA, deployment ID, release version), masking of sensitive keys, fingerprinting, and sampling (`fixed`, `adaptive`, `error-first`, `slow-first`). Custom processors and plugins can be registered with `use()`.
- **Delivery**: batching, retry with `fixed` / `linear` / `exponential` / `jitter` backoff, optional disk queue, dead-letter queue, graceful shutdown.
- **Profiles**: `development`, `production`, `testing`, `serverless` presets for retry, sampling, flush interval, disk queue and debug output.
- `ProcessPlugin` for logging `SIGINT` / `SIGTERM` / `beforeExit`.

## Installation

```bash
npm i @utkarshpayal/logsense-sdk
```

## Quick start

```ts
import express from "express";
import { LogSense, logsense } from "@utkarshpayal/logsense-sdk";
import { logsenseMiddleware } from "@utkarshpayal/logsense-sdk/express";

const client = new LogSense({
  apiKey: process.env.LOGSENSE_API_KEY!,
  service: "payment-api",
  organizationId: process.env.LOGSENSE_ORGANIZATION_ID!,
  projectId: process.env.LOGSENSE_PROJECT_ID!,
  environment: "production",
});

const app = express();
const [logRequests, logErrors] = logsenseMiddleware(client, { slowThresholdMs: 500 });

app.use(logRequests);

app.post("/payments", (req, res) => {
  client.logger.info("Payment initiated", { requestId: req.logsense?.requestId });
  res.json({ success: true });
});

app.use(logErrors);
app.listen(3000);

// On shutdown
process.on("SIGTERM", () => client.shutdown());
```

`LogSense` is an alias of `LogSenseClient`. To use the global `logsense` API (`track`, `captureException`, `startSpan`, `identify`, `business.*`, …), initialise it with `logsense.init(config)`, which creates or returns a single global client.

`apiKey`, `service`, `organizationId` and `projectId` are required; the constructor throws if any is missing (from both the config object and the environment).

## Usage

### Logging

```ts
client.logger.info("User logged in", { userId });
client.logger.warn("Slow database query", { ms: 812 });
client.logger.error("Payment failed", err, { paymentId });   // error(message, error?, metadata?)
```

### Global API

```ts
logsense.init({ /* config */ });

await logsense.captureException(new Error("boom"));
logsense.setUser({ id: "u_123", role: "admin" });
logsense.setOrganization("org_1");
const span = logsense.startSpan("checkout");

await logsense.trackBusinessEvent("Plan Upgraded", { plan: "pro" });
await logsense.business.orderCreated("ord_1", 49.99, "USD");
await logsense.business.paymentSucceeded("pay_1", 49.99, "USD");
await logsense.onboarding.userOnboarded("u_123", "profile_completed");

logsense.metrics();   // queue size, retries, failures, dropped events, batch size, latency
logsense.health();
await logsense.shutdown();
```

Other identity/session helpers: `identify`, `setWorkspace`, `clearIdentity`, `resetIdentity`, `currentSession`, `trackOnboarding`, `track`.

### Database and cache instrumentation

```ts
import { wrapPg, wrapRedisClient } from "@utkarshpayal/logsense-sdk";

wrapPg(pool, client.collector);
wrapRedisClient(redis, client.collector);
```

Also available: `wrapMysql2`, `prismaLogSenseExtension(collector)`, `mongooseLogSensePlugin`.

### Plugins and processors

```ts
import { ProcessPlugin, SamplingProcessor } from "@utkarshpayal/logsense-sdk";

client.use(myProcessor);   // any EventProcessor or LogSensePlugin
```

See [`docs/advanced/custom-plugins-and-processors.md`](docs/advanced/custom-plugins-and-processors.md).

## Configuration

Every option can be passed to the constructor; most can also come from environment variables. Precedence is: constructor option → environment variable → profile default → built-in default (`src/core/config.ts`).

| Option | Environment variable | Default | Description |
| --- | --- | --- | --- |
| `apiKey` | `LOGSENSE_API_KEY` | — (required) | Project API key |
| `service` | `LOGSENSE_SERVICE` | — (required) | Service name |
| `organizationId` | `LOGSENSE_ORGANIZATION_ID` / `LOGSENSE_ORG_ID` | — (required) | Organization ID |
| `projectId` | `LOGSENSE_PROJECT_ID` | — (required) | Project ID |
| `endpoint` | `LOGSENSE_ENDPOINT` | Hosted LogSense `/v1/events` endpoint | Ingestion URL (point it at your own `logsense-server`) |
| `environment` | `LOGSENSE_ENVIRONMENT`, then `NODE_ENV` | `development` | Environment name |
| `serviceVersion` | `LOGSENSE_SERVICE_VERSION` | — | Service version |
| `profile` | `LOGSENSE_PROFILE` (else derived from `NODE_ENV`) | `development` | `development` \| `production` \| `testing` \| `serverless` |
| `batchSize` | `LOGSENSE_BATCH_SIZE` | `100` | Events per batch |
| `flushInterval` | `LOGSENSE_FLUSH_INTERVAL` | `5000` ms | Flush interval |
| `debug` | `LOGSENSE_DEBUG` | `false` | Print SDK debug output |
| `diskQueueEnabled` | `LOGSENSE_DISK_QUEUE_ENABLED` | `false` (`true` in `production` profile) | Persist the queue to disk |
| `diskQueueDir` | `LOGSENSE_DISK_QUEUE_DIR` | `.logsense/queue` | Disk queue directory |
| `disableInstrumentation` | `LOGSENSE_DISABLE_INSTRUMENTATION` | `false` | Turn off automatic instrumentation |
| `metricsIntervalMs` | `LOGSENSE_METRICS_INTERVAL` | `3600000` | Runtime metrics interval |
| `retry` | — | `{ maxAttempts: 5, backoffType: "jitter", baseDelayMs: 1000, maxDelayMs: 30000 }` | Retry policy |
| `sampling` | — | profile-dependent | `{ strategy, rate, minRate, maxRate, windowSizeMs, maxEventsPerWindow, slowThresholdMs }` |
| `masking` | — | enabled; masks `password`, `token`, `cookie`, `authorization`, `apiKey`, `secret`, `passwd`, `access_token`, `client_secret` | `{ enabled, keys, patterns }` |
| `plugins` | — | `[]` | Processors / plugins to register |

The enrichment processor also reads `LOGSENSE_REGION` (or `AWS_REGION`), `LOGSENSE_GIT_SHA` (or `GIT_SHA`), `LOGSENSE_DEPLOYMENT_ID` (or `DEPLOYMENT_ID`) and `LOGSENSE_RELEASE_VERSION` (or `RELEASE_VERSION`).

Express middleware options: `slowThresholdMs` (default `1000`) and `metadata` (merged into every middleware log entry).

## Event pipeline

```
logger / instrumentation / global API
  → EventBuilder → Collector
  → Pipeline (enrichment → masking → fingerprint → sampling → custom processors)
  → Queue (memory or disk) → BatchManager → RetryManager (→ DLQ) → HTTP transport
  → LogSense server
```

See [`docs/architecture/logging-pipeline-and-context.md`](docs/architecture/logging-pipeline-and-context.md).

## Development

```bash
npm install
npm run build        # rimraf dist && tsc
npm run typecheck    # tsc --noEmit
npm test             # tsx tests/verification.ts
npm run test:v1      # tsx tests/v1-features.ts
npm run test:express # tsx tests/express-middleware.ts
npm run demo         # tsx tests/demo-app.ts
npm run simulate     # tsx tests/simulation.ts
npm run dev          # tsx watch src/index.ts
npm run clean        # rimraf dist
```

Only `dist/` is published (`files` in `package.json`). The `tests/` scripts are runnable verification/demo scripts rather than a test-runner suite.

### Source layout

```
src/
  core/            LogSenseClient, global `logsense` API, config resolution/validation
  logger/          Structured logger
  middleware/      Express middleware (exported as ./express)
  instrumentation/ HTTP server/client, exceptions, runtime monitor, DB and Redis helpers
  pipeline/        Pipeline, plugin/processor interfaces, built-in processors
  event/           Event types, builder, factory, validator
  queue/           Memory and disk queues
  batch/ retry/ transport/   Delivery (batching, backoff, DLQ, HTTP)
  context/ tracing/ session/ breadcrumbs/ fingerprinting/ monitoring/ entities/ plugins/ utils/
docs/              Full documentation (see docs/SUMMARY.md)
```

## Best practices

- Log business events explicitly; let instrumentation handle infrastructure events.
- Include identifiers (userId, orderId, projectId) in metadata and keep it structured.
- Never log passwords, tokens or card numbers; extend `masking.keys` for your own sensitive fields.
- Call `shutdown()` on exit so queued events are flushed.
- Use the `production` profile (adaptive sampling, disk queue) in production.
