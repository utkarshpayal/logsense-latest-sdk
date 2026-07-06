# LogSense SDK Data Logging Specification

This specification provides a detailed guide on what data is logged under different scenarios (automatic instrumentation, manual logging, business tracking, process lifecycle) within the LogSense Node SDK, complete with realistic JSON examples.

---

## 1. Express Middleware (`logsenseMiddleware`)
Captures incoming requests, outgoing responses, slow requests, and unhandled errors.

### Case A: Incoming Request (`request.incoming`)
- **Trigger**: When an HTTP request reaches the server.
- **Level**: `info`
- **Fields**:
  - `category`: `"http"`
  - `type`: `"request.incoming"`
  - `action`: `"started"`
  - `severity`: `"info"`
  - `message`: `"→ GET /api/v1/users"`
  - `tenant`: Organization, project, environment, and service info.
  - `relationships`: `{ requestId, traceId, sessionId (opt) }`
  - `http`:
    - `method`: e.g. `"GET"`
    - `url`: e.g. `"/api/v1/users?limit=10"`
    - `clientIp`: IP address of client
    - `userAgent`: User agent header value
    - `headers`: Object containing stringified headers
    - `query`: Parsed query parameters object
- **Example Payload**:
```json
{
  "version": "1.0.0",
  "category": "http",
  "type": "request.incoming",
  "action": "started",
  "severity": "info",
  "message": "→ GET /api/v1/users",
  "timestamp": "2026-07-03T12:00:00.000Z",
  "tenant": {
    "organizationId": "org_123",
    "projectId": "proj_abc",
    "environment": "production",
    "service": "api-gateway"
  },
  "relationships": {
    "eventId": "evt_987654321",
    "requestId": "req_555aaa",
    "traceId": "tr_555aaa"
  },
  "runtime": {
    "hostname": "prod-server-01",
    "sdkVersion": "1.0.0"
  },
  "http": {
    "method": "GET",
    "url": "/api/v1/users?limit=10",
    "clientIp": "192.168.1.50",
    "userAgent": "Mozilla/5.0...",
    "headers": {
      "host": "api.domain.com",
      "accept": "application/json"
    },
    "query": {
      "limit": "10"
    }
  }
}
```

### Case B: Completed Request (`request.completed`)
- **Trigger**: When the HTTP response is successfully finished.
- **Level**: `info` (if duration is within threshold)
- **Fields**:
  - `category`: `"http"`
  - `type`: `"request.completed"`
  - `action`: `"completed"`
  - `severity`: `"info"`
  - `message`: `"← GET /api/v1/users 200 (12ms)"`
  - `duration`: Duration in milliseconds
  - `http`:
    - Same as incoming request details
    - `statusCode`: HTTP response status code
    - `contentLength`: Response size (bytes)
    - `route`: Matched route path (e.g. `"/api/v1/users"`)
    - `body`: Request body (safely serialized and truncated if > 5000 chars)
  - `actor` (optional): Set if user/token details are attached to the request (e.g. `req.user`, `req.tokenData` or `req.authenticatedUser`).
    - `type`: `"user"`
    - `id`: User identifier
    - `name`: User display name
    - `email`: User email
    - `role`: User role
- **Example Payload**:
```json
{
  "version": "1.0.0",
  "category": "http",
  "type": "request.completed",
  "action": "completed",
  "severity": "info",
  "message": "← GET /api/v1/users 200 (12ms)",
  "timestamp": "2026-07-03T12:00:00.012Z",
  "duration": 12,
  "tenant": {
    "organizationId": "org_123",
    "projectId": "proj_abc",
    "environment": "production",
    "service": "api-gateway"
  },
  "relationships": {
    "eventId": "evt_987654322",
    "requestId": "req_555aaa",
    "traceId": "tr_555aaa"
  },
  "actor": {
    "type": "user",
    "id": "usr_999",
    "name": "Jane Doe",
    "email": "jane@example.com",
    "role": "admin"
  },
  "http": {
    "method": "GET",
    "url": "/api/v1/users?limit=10",
    "clientIp": "192.168.1.50",
    "userAgent": "Mozilla/5.0...",
    "statusCode": 200,
    "route": "/api/v1/users",
    "headers": {
      "host": "api.domain.com",
      "accept": "application/json"
    },
    "query": {
      "limit": "10"
    }
  }
}
```

### Case C: Slow Request (`request.slow`)
- **Trigger**: When response duration exceeds `slowThresholdMs` (default: 1000ms).
- **Level**: `warn`
- **Fields**: Adds `slowThresholdMs` in the warning metadata and sets the type/action to `"request.slow"` / `"request.slow"`.
- **Example Payload**:
```json
{
  "version": "1.0.0",
  "category": "http",
  "type": "request.slow",
  "action": "failed",
  "severity": "warn",
  "message": "⚠ Slow request: POST /api/v1/reports completed in 1500ms",
  "timestamp": "2026-07-03T12:01:01.500Z",
  "duration": 1500,
  "tenant": {
    "organizationId": "org_123",
    "projectId": "proj_abc",
    "environment": "production",
    "service": "api-gateway"
  },
  "relationships": {
    "eventId": "evt_987654323",
    "requestId": "req_555bbb",
    "traceId": "tr_555bbb"
  },
  "http": {
    "method": "POST",
    "url": "/api/v1/reports",
    "clientIp": "192.168.1.50",
    "statusCode": 201,
    "route": "/api/v1/reports",
    "body": { "type": "financial_yearly" }
  },
  "metadata": {
    "slowThresholdMs": 1000
  }
}
```

### Case D: Unhandled Route Error (`request.error`)
- **Trigger**: Uncaught express route errors intercepted by the error handling middleware.
- **Level**: `error`
- **Fields**:
  - `category`: `"http"` or `"exception"`
  - `type`: `"request.error"`
  - `action`: `"failed"`
  - `severity`: `"error"`
  - `message`: `"✖ Unhandled route error: <Error Message>"`
  - `errorName`: e.g. `"TypeError"`
  - `stack`: Stack trace of the error
- **Example Payload**:
```json
{
  "version": "1.0.0",
  "category": "http",
  "type": "request.error",
  "action": "failed",
  "severity": "error",
  "message": "✖ Unhandled route error: Cannot read properties of undefined (reading 'id')",
  "timestamp": "2026-07-03T12:02:00.000Z",
  "tenant": {
    "organizationId": "org_123",
    "projectId": "proj_abc",
    "environment": "production",
    "service": "api-gateway"
  },
  "relationships": {
    "eventId": "evt_987654324",
    "requestId": "req_555ccc",
    "traceId": "tr_555ccc"
  },
  "metadata": {
    "errorName": "TypeError",
    "stack": "TypeError: Cannot read properties of undefined (reading 'id')\n    at /src/routes/users.js:14:25..."
  }
}
```

---

## 2. Database Queries (`db.query`)
Captured for pg, mysql2, mongoose/mongodb, and Prisma operations.

- **Trigger**: When a database operation finishes.
- **Action**: `"completed"` (success) or `"failed"` (failure)
- **Severity**: `"info"` (success) or `"error"` (failure)
- **Fields**:
  - `category`: `"database"`
  - `type`: `"db.query"`
  - `duration`: Execution duration in ms
  - `relationships`: Links to the parent trace/request context
  - `database`:
    - `provider`: `"postgres"` | `"mysql"` | `"mongodb"`
    - `operation`: `"SELECT"` | `"INSERT"` | `"UPDATE"` | `"DELETE"` | `"UPSERT"` | etc.
    - `table` / `collection`: Table name or MongoDB collection name
    - `success`: boolean
    - `query`: The SQL query text or query filter object (parameters are stripped to avoid PII leak)
    - `rowsAffected` (optional): Number of rows affected (SQL databases only)

### Example Payload (Mongoose Success):
```json
{
  "version": "1.0.0",
  "category": "database",
  "type": "db.query",
  "action": "completed",
  "severity": "info",
  "message": "Mongoose User.find succeeded",
  "timestamp": "2026-07-03T12:00:00.005Z",
  "duration": 4,
  "relationships": {
    "eventId": "evt_db_001",
    "requestId": "req_555aaa",
    "traceId": "tr_555aaa"
  },
  "database": {
    "provider": "mongodb",
    "operation": "SELECT",
    "collection": "User",
    "success": true,
    "query": "{\"status\":\"ACTIVE\"}"
  }
}
```

### Example Payload (PostgreSQL Failure):
```json
{
  "version": "1.0.0",
  "category": "database",
  "type": "db.query",
  "action": "failed",
  "severity": "error",
  "message": "PG query SELECT failed",
  "timestamp": "2026-07-03T12:00:00.120Z",
  "duration": 9,
  "relationships": {
    "eventId": "evt_db_002",
    "requestId": "req_555bbb",
    "traceId": "tr_555bbb"
  },
  "database": {
    "provider": "postgres",
    "operation": "SELECT",
    "success": false,
    "query": "SELECT * FROM non_existent_table WHERE active = $1"
  }
}
```

---

## 3. Redis Cache Operations (`cache.operation`)
- **Trigger**: Intercepted cache calls: `get`, `set`, `del`, `delete`.
- **Fields**:
  - `category`: `"cache"`
  - `type`: `"cache.operation"`
  - `action`: `"success"` / `"failed"`
  - `cache`:
    - `provider`: `"redis"`
    - `operation`: `"GET"` | `"SET"` | `"DEL"`
    - `key`: Cache key
    - `hit`: boolean (only for GET: true if hit, false if miss)
    - `success`: boolean

### Example Payload (Redis GET Miss):
```json
{
  "version": "1.0.0",
  "category": "cache",
  "type": "cache.operation",
  "action": "success",
  "severity": "info",
  "message": "Redis GET on \"user:session:999\" - MISS",
  "timestamp": "2026-07-03T12:00:00.002Z",
  "duration": 2,
  "relationships": {
    "eventId": "evt_cache_001",
    "requestId": "req_555aaa",
    "traceId": "tr_555aaa"
  },
  "cache": {
    "provider": "redis",
    "operation": "GET",
    "key": "user:session:999",
    "hit": false,
    "success": true
  }
}
```

---

## 4. Outgoing HTTP Requests (`http.request` via HttpClientInstrumentation)
- **Trigger**: HTTP/HTTPS Client requests made from the application.
- **Header Enrichment**: SDK injects trace contexts (`x-trace-id`, `x-request-id`, `x-span-id`) into headers to propagate tracing downstream.
- **Fields**:
  - `category`: `"external"`
  - `type`: `"http.request"`
  - `action`: `"success"` / `"failed"`
  - `external`:
    - `provider`: `"http"`
    - `method`: HTTP method
    - `url`: Target URL
    - `statusCode`: Status code returned
    - `success`: boolean

### Example Payload:
```json
{
  "version": "1.0.0",
  "category": "external",
  "type": "http.request",
  "action": "success",
  "severity": "info",
  "message": "HTTP POST https://api.stripe.com/v1/charges - 200",
  "timestamp": "2026-07-03T12:00:00.500Z",
  "duration": 180,
  "relationships": {
    "eventId": "evt_ext_001",
    "requestId": "req_555aaa",
    "traceId": "tr_555aaa"
  },
  "external": {
    "provider": "http",
    "method": "POST",
    "url": "https://api.stripe.com/v1/charges",
    "statusCode": 200,
    "success": true
  }
}
```

---

## 5. System Exception Capture
Automatically intercepts uncaught exceptions and unhandled promise rejections.

- **Trigger**: Unhandled errors inside node.js runtime process.
- **Fields**:
  - `category`: `"exception"`
  - `type`: `"uncaughtException"` | `"unhandledRejection"`
  - `action`: `"failed"`
  - `severity`: `"fatal"` (uncaught) or `"error"` (unhandled promise rejection)
  - `exception`:
    - `name`: Error name
    - `message`: Error message
    - `stack`: Stack trace
    - `code` / `file` / `line` (if available on the error object)

### Example Payload (Uncaught Exception):
```json
{
  "version": "1.0.0",
  "category": "exception",
  "type": "uncaughtException",
  "action": "failed",
  "severity": "fatal",
  "message": "ReferenceError: x is not defined",
  "timestamp": "2026-07-03T12:05:00.000Z",
  "exception": {
    "name": "ReferenceError",
    "message": "x is not defined",
    "stack": "ReferenceError: x is not defined\n    at main (/src/index.js:5:3)..."
  }
}
```

---

## 6. Process Lifecycle & Runtime Metrics
Tracks startup events, exit statuses, and runtime performance stats.

### Case A: Process Start (`process.start`)
- **Trigger**: When the Runtime Monitor starts.
- **Fields**:
  - `category`: `"runtime"`
  - `type`: `"process.start"`
  - `action`: `"started"`
  - `metadata`: `{ pid, nodeVersion, arch, platform }`

### Case B: Periodic Metrics (`metrics`)
- **Trigger**: Every 10 seconds.
- **Fields**:
  - `category`: `"runtime"`
  - `type`: `"metrics"`
  - `runtimeMetrics`:
    - `cpu`: float (percentage)
    - `memory`: RSS size in bytes
    - `heapUsed`: Heap usage in bytes
    - `heapTotal`: Total heap in bytes
    - `eventLoopDelay`: Event loop lag in ms

### Example Payload (Metrics):
```json
{
  "version": "1.0.0",
  "category": "runtime",
  "type": "metrics",
  "action": "completed",
  "severity": "debug",
  "timestamp": "2026-07-03T12:00:10.000Z",
  "runtimeMetrics": {
    "cpu": 1.25,
    "memory": 45612032,
    "heapUsed": 15423800,
    "heapTotal": 31258880,
    "eventLoopDelay": 0.45
  },
  "runtime": {
    "pid": 12345,
    "cpu": 1.25,
    "memory": 45612032
  }
}
```

---

## 7. Manual Application Logging (`logger.<level>`)
- **Trigger**: When calling `logger.info`, `logger.warn`, `logger.error`, etc.
- **Fields**:
  - `category`: `"custom"` (or `"exception"` if error object is supplied)
  - `type`: `"log"` (or `"exception"` if error is supplied)
  - `action`: `"completed"`
  - `severity`: Chosen logger severity level
  - `metadata`: Custom key-value pairs passed as second parameter

### Example Payload:
```json
{
  "version": "1.0.0",
  "category": "custom",
  "type": "log",
  "action": "completed",
  "severity": "info",
  "message": "User verified email address",
  "timestamp": "2026-07-03T12:00:05.100Z",
  "relationships": {
    "eventId": "evt_log_001",
    "requestId": "req_555aaa",
    "traceId": "tr_555aaa"
  },
  "metadata": {
    "userId": "usr_999",
    "method": "verification_link"
  }
}
```

---

## 8. Tracing Spans (`span`)
- **Trigger**: When a span terminates (e.g. `span.end()`).
- **Fields**:
  - `category`: `"custom"`
  - `type`: `"span"`
  - `duration`: Span duration in ms
  - `relationships`: `{ eventId: "", traceId, spanId, parentEventId }`
  - `metadata`:
    - `spanName`: Name of the span
    - `startTime`: epoch ms
    - `endTime`: epoch ms
    - `attributes`: Custom attributes map
    - `events`: Inline events array (including exception details if `recordException` was called)

### Example Payload (Failed Span):
```json
{
  "version": "1.0.0",
  "category": "custom",
  "type": "span",
  "action": "failed",
  "severity": "error",
  "message": "Span process-payment failed",
  "timestamp": "2026-07-03T12:00:00.350Z",
  "duration": 350,
  "relationships": {
    "eventId": "",
    "traceId": "tr_555aaa",
    "spanId": "sp_777",
    "parentEventId": "sp_666"
  },
  "metadata": {
    "spanName": "process-payment",
    "startTime": 1783080000000,
    "endTime": 1783080000350,
    "attributes": {
      "provider": "stripe",
      "retryCount": 1
    },
    "events": [
      {
        "name": "exception",
        "timestamp": 1783080000340,
        "attributes": {
          "exception.type": "StripeConnectionError",
          "exception.message": "Network timeout",
          "exception.stacktrace": "StripeConnectionError: Network timeout..."
        }
      }
    ]
  }
}
```

---

## 9. Business Events & Presets (`logsense.business.*`)
Specialized high-level event tracking helpers.

- **Trigger**: Call to business preset functions (`orderCreated`, `paymentSucceeded`, etc.) or `logsense.trackBusinessEvent(name, metadata)`.
- **Fields**:
  - `category`: `"business"`
  - `type`: `"business"`
  - `action`: Business event name (e.g. `"order.created"`)
  - `metadata`: Custom transaction metadata (e.g. amount, orderId)

### Example Payload (Payment Succeeded):
```json
{
  "version": "1.0.0",
  "category": "business",
  "type": "business",
  "action": "payment.succeeded",
  "severity": "info",
  "message": "Business Event: payment.succeeded",
  "timestamp": "2026-07-03T12:00:00.600Z",
  "relationships": {
    "eventId": "evt_biz_001",
    "requestId": "req_555aaa",
    "traceId": "tr_555aaa"
  },
  "metadata": {
    "paymentId": "pay_stripe_888",
    "amount": 29.99,
    "currency": "USD"
  }
}
```
