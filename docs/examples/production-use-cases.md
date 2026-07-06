# Production Examples & Use Cases

This page provides complete, production-ready examples for integrating LogSense into various application architectures.

---

# 1. Express API with Database Instrumentation

This example demonstrates integrating LogSense into an Express API with database wrappers. It configures the Express middleware, wraps a PostgreSQL connection pool, and implements error boundary capturing.

```typescript
import express from "express";
import pg from "pg";
import { LogSense, wrapPg } from "@utkarshpayal/logsense-sdk";
import { logsenseMiddleware } from "@utkarshpayal/logsense-sdk/express";

// 1. Initialize LogSense SDK
const sdk = new LogSense({
  apiKey: process.env.LOGSENSE_API_KEY!,
  service: "user-directory-api",
  organizationId: process.env.LOGSENSE_ORG_ID!,
  projectId: process.env.LOGSENSE_PROJECT_ID!,
  environment: process.env.NODE_ENV ?? "production",
  profile: "production"
});

const app = express();
app.use(express.json());

// 2. Set up PostgreSQL Connection Pool and apply wrapPg decorator
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
wrapPg(pool, sdk.collector);

// 3. Register LogSense request logger middleware (must be FIRST)
const [logRequests, logErrors] = logsenseMiddleware(sdk, {
  slowThresholdMs: 200,
  metadata: { version: "1.2.0" }
});
app.use(logRequests);

// 4. Implement Route Handlers
app.get("/users/:id", async (req, res, next) => {
  const { id } = req.params;
  try {
    // The wrapPg decorator links this query to the active request context automatically
    const result = await pool.query("SELECT id, name, email FROM users WHERE id = $1", [id]);
    if (result.rows.length === 0) {
      sdk.logger.warn(`User with ID ${id} not found`, { targetId: id });
      return res.status(404).json({ error: "User not found" });
    }
    res.json(result.rows[0]);
  } catch (error) {
    next(error); // Forward to Express error boundary
  }
});

// 5. Register LogSense error handler middleware (must be LAST)
app.use(logErrors);

// 6. User-facing fallback response formatter
app.use((err: any, req: any, res: any, next: any) => {
  res.status(500).json({ error: "Internal Server Error" });
});

app.listen(8080, () => {
  sdk.logger.info("Service initialized and listening on port 8080");
});
```

---

# 2. Authentication Service with PII Masking and Child Loggers

This example demonstrates using **child loggers** to scope telemetry to specific modules, and custom **PII masking** configuration to prevent leaks of sensitive parameters like passwords or verification tokens.

```typescript
import { LogSense } from "@utkarshpayal/logsense-sdk";

const sdk = new LogSense({
  apiKey: process.env.LOGSENSE_API_KEY!,
  service: "identity-provider",
  organizationId: "org-1",
  projectId: "proj-1",
  masking: {
    enabled: true,
    keys: ["password", "token", "otp", "secretKey"]
  }
});

// Scoped child logger for the authentication engine module
const authLogger = sdk.logger.child({ module: "auth-engine" });

export async function loginUser(payload: Record<string, any>) {
  const { username, password, otpToken } = payload;
  
  // The child logger automatically inherits { module: "auth-engine" }
  authLogger.info("Login attempt initiated", { user: username });

  try {
    const user = await db.findUserByUsername(username);
    if (!user) {
      authLogger.warn("Authentication failed: User profile not found", { user: username });
      return { success: false, reason: "Invalid credentials" };
    }

    const isValidPassword = await verifyHash(password, user.passwordHash);
    if (!isValidPassword) {
      authLogger.warn("Authentication failed: Invalid credentials provided", { user: username });
      return { success: false, reason: "Invalid credentials" };
    }

    // Sensitive keys like "password" are automatically replaced with "[MASKED]"
    authLogger.info("Password verified successfully", { password });

    return { success: true, userId: user.id };
  } catch (error) {
    authLogger.captureException(error as Error, { user: username });
    throw error;
  }
}
```

---

# 3. Payment Gateway with Contextual Exception Capture

This example demonstrates logging transactional events and capturing exceptions with metadata inside a payment processing queue.

```typescript
import { LogSense } from "@utkarshpayal/logsense-sdk";

const sdk = new LogSense({
  apiKey: process.env.LOGSENSE_API_KEY!,
  service: "payment-gateway",
  organizationId: "org-1",
  projectId: "proj-1",
  profile: "production"
});

export async function processTransaction(txPayload: {
  transactionId: string;
  amount: number;
  currency: string;
  customerId: string;
}) {
  const { transactionId, amount, currency, customerId } = txPayload;
  
  // Create a child logger scoped to this transaction
  const txLogger = sdk.logger.child({ transactionId, customerId });
  txLogger.info("Payment transaction initiated", { amount, currency });

  try {
    const gatewayResult = await stripe.charge({
      amount: amount * 100, // in cents
      currency,
      metadata: { transactionId }
    });

    if (gatewayResult.status === "succeeded") {
      txLogger.info("Payment settled successfully", { gatewayReference: gatewayResult.id });
      return { success: true, reference: gatewayResult.id };
    } else {
      txLogger.warn("Payment charge failed at gateway", { gatewayStatus: gatewayResult.status });
      return { success: false, reason: gatewayResult.failure_message };
    }
  } catch (error: any) {
    // captureException extracts the error stack and merges transaction details
    txLogger.captureException(error as Error, {
      action: "settle_payment",
      chargeAmount: amount,
      chargeCurrency: currency
    });
    return { success: false, reason: "Gateway communication failure" };
  }
}
```

---

# 4. Asynchronous Cron/Background Worker

For CLI utilities, worker scripts, and cron tasks that exit immediately after execution, you must call `shutdown()` or `flush()` to send buffered logs before Node terminates.

```typescript
import { LogSense, ProcessPlugin } from "@utkarshpayal/logsense-sdk";

const sdk = new LogSense({
  apiKey: process.env.LOGSENSE_API_KEY!,
  service: "cleanup-cron-job",
  organizationId: "org-1",
  projectId: "proj-1",
  profile: "production"
});

// Install the ProcessPlugin to handle unexpected exits gracefully
const processPlugin = new ProcessPlugin(sdk);
processPlugin.install();

async function runCleanup() {
  sdk.logger.info("Database validation execution started");
  
  try {
    const expiredCount = await db.deleteExpiredSessions();
    sdk.logger.info("Database validation completed successfully", { deletedCount: expiredCount });
  } catch (error) {
    sdk.logger.captureException(error as Error, { jobName: "session_cleanup" });
    process.exitCode = 1;
  } finally {
    sdk.logger.info("Job cleanup completed. Shutting down queue channels.");
    
    // Block the thread to flush all pending logs before exiting
    await sdk.shutdown();
  }
}

runCleanup();
```
