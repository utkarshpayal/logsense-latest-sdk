# Production Best Practices & Tuning

This guide covers operational configurations, security rules, and performance guidelines for the LogSense Node.js SDK in production environments.

---

# 1. Logging Volume Control & Sampling

In high-throughput systems, logging every event can cause substantial network traffic and storage costs. To mitigate this:
*   Use sampling to control the volume of telemetry data.
*   Log only warning and error events under peak traffic, or sample info and debug logs.

### Configuring Sampling Rate
The SDK supports fixed-rate and adaptive sampling options:
```typescript
const client = new LogSense({
  apiKey: "...",
  sampling: {
    // 0.2 means only 20% of matching logs are sent to the server.
    // Errors and warnings are always collected.
    rate: 0.2,
    bySeverity: {
      debug: 0.05,  // Sample only 5% of debug logs
      info: 0.2     // Sample only 20% of info logs
    }
  }
});
```

---

# 2. Structured Metadata recommendations

Avoid logging unstructured raw strings. Use metadata fields to enable searching and filtering:

### Bad Pattern (Unstructured)
```typescript
logger.info(`User ${user.id} purchased item ${item.sku} for USD ${item.price}`);
```
Unstructured text strings cannot be easily queried or aggregated.

### Good Pattern (Structured)
```typescript
logger.info("Product purchased", {
  userId: user.id,
  productSku: item.sku,
  amount: item.price,
  currency: "USD"
});
```
Structured logs allow you to filter by `productSku` or aggregate purchase statistics on the dashboard.

---

# 3. PII and Security Guidelines

To prevent leaks of personally identifiable information (PII) or secrets:
*   Configure the SDK `masking` parameters to check fields like `password`, `ssn`, `accessToken`, and `creditCard`.
*   Avoid logging entire raw objects (e.g. `req.body`, database records, error contexts). Instead, pick specific safe fields to log.

```typescript
// Avoid
logger.error("Payment registration failed", { payload: req.body });

// Recommended
logger.error("Payment registration failed", {
  userId: req.body.userId,
  paymentType: req.body.paymentType
});
```

---

# 4. Resource Allocation and Queue Settings

To protect application memory and performance:
*   **Set memory boundaries**: Set `maxQueueSize` (default `10000`) to prevent out-of-memory errors if connection failures cause logs to build up in heap memory.
*   **Enable Disk Queueing**: Enable the disk queue in production to save logs to the local filesystem when the ingestion server is offline.

```typescript
const sdk = new LogSense({
  apiKey: "...",
  profile: "production",
  diskQueueEnabled: true,
  diskQueueDir: "./.logsense/queue-cache",
  maxQueueSize: 20000 // Buffer up to 20k events in memory before falling back to disk
});
```
