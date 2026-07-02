# SDK Configuration Guide

This guide details all configuration options for the LogSense SDK, validation parameters, and profiles.

---

# Purpose

SDK configurations dictate how telemetry events are validated, processed, buffered, retried, and transmitted. By adjusting these values, you can balance network resource consumption, memory footprints, CPU utilization, and telemetry delivery guarantees.

---

# Configuration Schema & Options

The SDK accepts a configuration object matching the `SDKConfig` interface. Below is the exhaustive reference:

| Option | Type | Default Value | Allowed Values | Description |
| :--- | :--- | :--- | :--- | :--- |
| `apiKey` | `string` | `undefined` | Any non-empty string | The secret credential used to authenticate requests to the LogSense ingestion server. |
| `endpoint` | `string` | `"https://api.logsense.com/v1/events"` | Absolute HTTP/HTTPS URL | The target endpoint where batched events are posted. |
| `service` | `string` | `undefined` | Any slug string | Identifier for your microservice or application. |
| `environment` | `string` | `"development"` | Any environment string | Current runtime tier (e.g. `production`, `staging`). |
| `serviceVersion` | `string` | `undefined` | SemVer/Git SHA string | Release version of your active application. |
| `organizationId` | `string` | `undefined` | UUID/Unique Slug | Identifies your organization account. |
| `projectId` | `string` | `undefined` | UUID/Unique Slug | Identifies your specific workspace project. |
| `batchSize` | `number` | `100` | Integers > 0 | Max events bundled in a single HTTP payload. |
| `flushInterval` | `number` | `5000` | Milliseconds > 0 | Max time an event can wait in the queue before a flush is triggered. |
| `debug` | `boolean` | `false` | `true`, `false` | Enables printouts of internal SDK diagnostic events. |
| `diskQueueEnabled`| `boolean` | `false` | `true`, `false` | Fall back to local disk storage if the server goes offline. |
| `diskQueueDir` | `string` | `".logsense/queue"` | Absolute or relative path | Location of the SQLite/file-based disk buffer. |
| `disableInstrumentation`| `boolean`| `false` | `true`, `false` | Disables automated patching of core modules and database drivers. |
| `profile` | `string` | Auto-detected | `"production"`, `"development"`, `"testing"`, `"serverless"` | Pre-packaged operational settings. |

---

# Built-in Profiles

Profiles allow you to configure the SDK instantly for different deployment tiers. If you do not supply an explicit `profile`, it is inferred from your environment:
*   If `NODE_ENV === "test"`, the `testing` profile is applied.
*   If `NODE_ENV === "production"`, the `production` profile is applied.
*   Otherwise, the `development` profile is applied.

### Profile Default Matrix

| Setting | Production Profile | Development Profile | Testing Profile | Serverless Profile |
| :--- | :--- | :--- | :--- | :--- |
| `maxAttempts` | `5` | `3` | `0` | `3` |
| `baseDelayMs` | `1000` | `500` | `N/A` | `1000` |
| `maxDelayMs` | `30000` | `5000` | `N/A` | `N/A` |
| `flushInterval` | `5000` | `1000` | `1` | `1` |
| `diskQueue` | `true` | `false` | `false` | `false` |
| `sampling` | `adaptive` | `fixed (1.0)` | `fixed (1.0)` | `fixed (1.0)` |
| `debug` | `false` | `true` | `true` | `false` |

---

# Code Examples

### 1. Simple Development Configuration
```typescript
import { LogSense } from "@logsense/node";

const client = new LogSense({
  apiKey: "ls_dev_key",
  service: "web-server",
  organizationId: "org-1",
  projectId: "proj-1",
  profile: "development"
});
```

### 2. High-Throughput Production Microservice Configuration
```typescript
import { LogSense } from "@logsense/node";

const client = new LogSense({
  apiKey: process.env.LOGSENSE_API_KEY!,
  service: "payment-processor",
  organizationId: "my-org",
  projectId: "payment-project",
  profile: "production",
  batchSize: 250,          // Aggregate larger batches
  flushInterval: 2000,     // Send events every 2 seconds
  sampling: {
    type: "adaptive",
    windowSizeMs: 10000,
    maxEventsPerWindow: 2000
  },
  masking: {
    enabled: true,
    keys: ["card_number", "cvv", "security_code", "token"]
  }
});
```

### 3. Serverless Configuration (AWS Lambda / Vercel Edge)
In serverless environments, background tasks cannot outlive the handler execution. We must flush immediately:
```typescript
import { LogSense } from "@logsense/node";

const client = new LogSense({
  apiKey: process.env.LOGSENSE_API_KEY!,
  service: "auth-lambda",
  organizationId: "org-1",
  projectId: "proj-1",
  profile: "serverless",    // Disables background queues, flushInterval is 1ms
});
```

---

# Performance & Memory Tuning

### Impact of Batch Size and Flush Interval
Large values for `batchSize` reduce HTTP headers overhead and improve ingestion throughput, but they consume more memory because events remain buffered in the heap.
*   **High Traffic (>1000 rps)**: Set `batchSize` to `250` - `500` and `flushInterval` to `2000`.
*   **Low Traffic (<10 rps)**: Keep defaults (`batchSize: 100`, `flushInterval: 5000`) or use `flushInterval: 1000` to see logs on your dashboard faster.

### Disk Queue Backpressure
When `diskQueueEnabled` is active, the SDK writes events to the local filesystem if the ingestion server becomes unreachable. Make sure the target disk has sufficient storage capacity and write permissions.

---

# Security & Compliance (PII Masking)

The SDK provides automatic field-level masking before telemetry leaves your memory space:
```typescript
const client = new LogSense({
  masking: {
    enabled: true,
    keys: ["password", "authorization", "ssn", "secret"],
    patterns: [
      "^(1[0-2]|0[1-9])/(3[01]|[12][0-9]|0[1-9])/[0-9]{4}$" // Date regex
    ]
  }
});
```
Any key matching these names or matching these patterns inside event payloads is replaced with `[MASKED]` during the pipeline phase. This prevents sensitive customer data from being written to logs.
