# LogSense Node SDK Guide

> Complete developer guide for integrating and using the LogSense SDK.

## Table of Contents

1.  Introduction
2.  Installation
3.  Quick Start
4.  SDK Initialization
5.  Configuration Options
6.  Automatic Logging
7.  Manual Logging
8.  Exception Logging
9.  Request Context
10. Child Loggers
11. Middleware
12. Structured Metadata
13. Performance & Queueing
14. Best Practices
15. Common Patterns
16. Troubleshooting
17. Production Checklist

------------------------------------------------------------------------

# 1. Introduction

LogSense is a production-ready logging SDK for Node.js that provides:

-   Structured JSON logging
-   Automatic request/response logging
-   Exception capture
-   Queueing
-   Batching
-   Retry with exponential backoff
-   Request correlation (requestId / traceId)
-   Middleware support
-   Dashboard integration

------------------------------------------------------------------------

# 2. Installation

``` bash
npm install @logsense/node
```

------------------------------------------------------------------------

# 3. Quick Start

``` ts
import { LogSense } from "@logsense/node";

const logger = new LogSense({
  apiKey: process.env.LOGSENSE_API_KEY!,
  endpoint: "https://api.logsense.dev/logs",
  service: "payment-api",
  environment: "production",
});
```

------------------------------------------------------------------------

# 4. Configuration

``` ts
new LogSense({
  apiKey: "...",
  endpoint: "...",
  service: "payment-api",
  environment: "production",
  version: "1.0.0",
  batchSize: 100,
  flushInterval: 5000,
  timeout: 5000,
  maxRetries: 5,
  slowRequestThreshold: 300,
  debug: false,
});
```

  Option                 Description
  ---------------------- --------------------------------
  apiKey                 Project API key
  endpoint               LogSense ingestion endpoint
  service                Service name
  environment            dev/staging/prod
  version                Application version
  batchSize              Logs per batch
  flushInterval          Auto flush interval
  timeout                HTTP timeout
  maxRetries             Retry count
  slowRequestThreshold   Slow request warning threshold
  debug                  SDK debug mode

------------------------------------------------------------------------

# 5. Manual Logs

``` ts
logger.info("User logged in");
logger.debug("Cache miss");
logger.warn("Slow database query");
logger.error("Payment failed");
```

With metadata:

``` ts
logger.info("Order created", {
  orderId,
  userId,
  amount,
});
```

------------------------------------------------------------------------

# 6. Business Event Examples

``` ts
logger.info("User Registered", { userId });
logger.info("Payment Started", { paymentId });
logger.info("Payment Completed", { paymentId });
logger.info("API Key Generated", { projectId });
logger.info("Project Created", { projectId });
```

------------------------------------------------------------------------

# 7. Exception Logging

``` ts
try {
  // code
} catch (error) {
  logger.captureException(error);
}
```

Captured fields:

-   Error name
-   Message
-   Stack
-   Fingerprint
-   Request ID
-   Trace ID

------------------------------------------------------------------------

# 8. Express Middleware

``` ts
import { logsenseMiddleware } from "@logsense/node/express";

app.use(logsenseMiddleware(logger));
```

Automatically logs:

-   Incoming request
-   Response
-   Status code
-   Duration
-   Slow requests
-   Route errors
-   requestId
-   traceId

------------------------------------------------------------------------

# 9. Automatically Captured Logs

## Request

-   Method
-   URL
-   Route
-   Query
-   Params
-   IP
-   User-Agent

## Response

-   Status
-   Duration
-   Content Length

## Errors

-   Unhandled exceptions
-   Promise rejections
-   Route errors

## Runtime

-   Startup
-   Shutdown
-   Memory
-   CPU
-   Health checks

## Infrastructure

-   Queue flush
-   Retry attempts
-   Transport failures

------------------------------------------------------------------------

# 10. Child Logger

``` ts
const paymentLogger = logger.child({
  module: "payment"
});

paymentLogger.info("Payment Started");
```

------------------------------------------------------------------------

# 11. Request Context

``` ts
req.logger.info("User authenticated");
```

Automatically attaches:

-   requestId
-   traceId
-   route
-   method
-   service

------------------------------------------------------------------------

# 12. Queue & Retry

Pipeline:

    Application
        ↓
    Logger
        ↓
    Queue
        ↓
    Batch
        ↓
    Retry
        ↓
    Transport
        ↓
    LogSense Backend

Benefits:

-   No log loss
-   Reduced HTTP calls
-   Background uploads

------------------------------------------------------------------------

# 13. Best Practices

-   Log business events manually.
-   Let middleware log infrastructure events.
-   Always include IDs (userId, orderId, projectId).
-   Avoid logging secrets.
-   Mask passwords and tokens.
-   Use child loggers for modules.
-   Keep metadata structured.

------------------------------------------------------------------------

# 14. Things to Avoid

-   Logging passwords
-   Logging JWT tokens
-   Logging credit card numbers
-   Logging entire request bodies in production
-   Logging large binary payloads

------------------------------------------------------------------------

# 15. Production Checklist

-   Enable batching
-   Enable retries
-   Configure timeouts
-   Configure slow request threshold
-   Use middleware
-   Capture exceptions
-   Use request correlation
-   Monitor queue size
-   Rotate API keys

------------------------------------------------------------------------

# 16. Example Project

``` ts
const logger = new LogSense({
  apiKey: process.env.LOGSENSE_API_KEY!,
  service: "payment-api",
  environment: "production",
});

app.use(logsenseMiddleware(logger));

app.post("/payments", async (req, res) => {
  logger.info("Payment initiated", {
    userId: req.user.id,
    amount: req.body.amount,
  });

  res.json({ success: true });
});
```

------------------------------------------------------------------------

# 17. Typical Log Lifecycle

    logger.info()

    ↓

    Event Builder

    ↓

    Collector

    ↓

    Pipeline

    ↓

    Enrichment

    ↓

    Masking

    ↓

    Fingerprint

    ↓

    Queue

    ↓

    Batch

    ↓

    Retry

    ↓

    Transport

    ↓

    LogSense Backend

    ↓

    Dashboard

------------------------------------------------------------------------

# 18. Future Integrations

-   Express
-   Fastify
-   NestJS
-   Axios
-   Fetch
-   PostgreSQL
-   MongoDB
-   Redis
-   BullMQ
-   Kafka
-   OpenTelemetry