# Troubleshooting & Diagnostics

This guide covers diagnosing issues and resolving common configuration errors in the LogSense SDK.

---

# 1. Logs Not Appearing on the Dashboard

If events are not showing up in the LogSense Web UI:

### Step 1: Enable SDK Debug Mode
Enable debug mode in your SDK configuration to print internal SDK operations:
```typescript
const sdk = new LogSense({
  apiKey: "...",
  debug: true // Prints internal SDK operations to stderr
});
```
Look for error logs like `[LogSense] [ERROR] Ingestion server returned 401 Unauthorized` or `[LogSense] Connection timed out`.

### Step 2: Verify API Key and Endpoints
*   Confirm that your `apiKey`, `organizationId`, and `projectId` are correct and match the values in your project settings.
*   Ensure your network environment allows outbound HTTP connections to `https://api.logsense.com/v1/events` (or your custom proxy endpoint).

### Step 3: Check Script Exits
If you are running CLI scripts or short-lived serverless tasks (like AWS Lambda), ensure you call `await sdk.flush()` or `await sdk.shutdown()` before exiting. Otherwise, the process may terminate before the queue can send the events.

---

# 2. Memory Growth & Queue Congestion Warnings

If the SDK prints warning logs like `[LogSense] [WARN] Event Queue limit reached. Dropping events.`:

### Reason
The application is generating events faster than the network transport can transmit them, or connection failures are preventing the queue from flushing.

### Resolution
1.  **Check Network Health**: Ensure there are no DNS resolution failures or firewalls blocking connection to the ingestion endpoint.
2.  **Increase Ingestion Throughput**:
    *   Increase `batchSize` to group more events into fewer HTTP requests.
    *   Reduce `flushInterval` to flush the queue more frequently.
3.  **Configure Memory Boundaries**: Tune `maxQueueSize` to limit memory consumption under load.

---

# 3. Request/Trace ID Correlation Failures

If HTTP logs and database logs are not sharing correlation IDs:

### Check Middleware Registration Order
Ensure the LogSense request handler is registered **first**, before any other middleware or routes:
```typescript
const app = express();
const [logRequests, logErrors] = logsenseMiddleware(sdk);

app.use(logRequests); // Must be registered before any routes or body parsers
app.use(express.json());
```
If you register a route handler before registering `logRequests`, downstream operations in that route handler will not be executed within the AsyncLocalStorage context.

### Check Async Execution Paths
If your code uses external async wrappers or runs code outside the standard Express request-response loop (like scheduled intervals, worker queues, or detached promises), the context is lost. Wrap these tasks manually using `contextStore.run()` to preserve trace context:
```typescript
import { contextStore } from "@logsense/node/context";

// Preserve trace context across decoupled execution paths
contextStore.run(activeContext, () => {
  // Nested async operations will inherit the trace context
});
```
