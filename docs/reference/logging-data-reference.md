# LogSense SDK Data Logging Reference

This reference guide provides a complete and detailed breakdown of **every scenario** in which the LogSense SDK captures and logs telemetry data. It lists the triggering cases, the exact properties collected, and realistic JSON payload examples for each case.

---

## Table of Contents
1. [Common Base Envelope Fields](#1-common-base-envelope-fields)
2. [Case 1: Custom Manual Logging API](#case-1-custom-manual-logging-api)
3. [Case 2: Express Middleware (HTTP Requests & Responses)](#case-2-express-middleware-http-requests--responses)
4. [Case 3: Native HTTP Server Instrumentation](#case-3-native-http-server-instrumentation)
5. [Case 4: Outgoing HTTP Client Request Instrumentation](#case-4-outgoing-http-client-request-instrumentation)
6. [Case 5: Database Query Instrumentation (Prisma, Mongoose, PostgreSQL, MySQL)](#case-5-database-query-instrumentation-prisma-mongoose-postgresql-mysql)
7. [Case 6: Redis Cache Operations Instrumentation](#case-6-redis-cache-operations-instrumentation)
8. [Case 7: Automatic Exception Capture (Uncaught & Unhandled)](#case-7-automatic-exception-capture-uncaught--unhandled)
9. [Case 8: Runtime Metrics & Process Lifecycle Events](#case-8-runtime-metrics--process-lifecycle-events)
10. [Case 9: Contextual Breadcrumbs Management](#case-9-contextual-breadcrumbs-management)

---

## 1. Common Base Envelope Fields

Every event dispatched by the LogSense SDK is structured as a JSON document and shares a set of common metadata fields (the "Envelope"). This ensures consistency and enables cross-event correlation.

| Field Name | Type | Description | Example |
| :--- | :--- | :--- | :--- |
| `version` | `string` | The LogSense payload schema version. | `"2.0.0"` |
| `category` | `string` | High-level category (`http`, `database`, `cache`, `exception`, `runtime`, `custom`). | `"http"` |
| `type` | `string` | Case-specific event name identifier. | `"request.completed"` |
| `action` | `string` | Execution phase or status (`started`, `success`, `completed`, `failed`). | `"completed"` |
| `severity` | `string` | Log severity level (`trace`, `debug`, `info`, `warn`, `error`, `fatal`). | `"info"` |
| `message` | `string` | Human-readable log or telemetry description. | `"→ GET /api/v1/users"` |
| `timestamp` | `string` | ISO 8601 representation of event occurrence. | `"2026-07-03T07:12:45.312Z"` |
| `duration` | `number` (optional) | Execution latency or run duration in milliseconds. | `45` |
| `relationships` | `object` | IDs used for tracing and event correlation. Contains `traceId`, `requestId`, `spanId`, `sessionId`. | *See below* |
| `tenant` | `object` | Namespace describing organization, project, environment, and service name. | *See below* |
| `actor` | `object` (optional) | The authenticated identity causing the action (User, Admin, API Key). | *See below* |
| `runtime` | `object` (optional) | Host metrics context, containing `pid`, `cpu` usage, and `memory` RSS. | *See below* |
| `metadata` | `object` (optional) | Arbitrary key-value metadata logs, child logger tags, and breadcrumbs. | *See below* |

---

## Case 1: Custom Manual Logging API

### Trigger
Triggered when developers manually invoke standard logger functions in their code:
* `logger.trace(message, metadata)`
* `logger.debug(message, metadata)`
* `logger.info(message, metadata)`
* `logger.warn(message, metadata)`
* `logger.error(message, error, metadata)`
* `logger.fatal(message, error, metadata)`

### Captured Data
* **Standard Logs**: Severity level, log message, manual key-value metadata object.
* **Error Logs**: Error class name, error message, stack trace, error code, file name, and line number where the error was thrown (if available).

### Payload Examples

#### Example A: Manual Info Log with Custom Metadata
```json
{
  "version": "2.0.0",
  "category": "custom",
  "type": "log",
  "action": "completed",
  "severity": "info",
  "message": "User checked out shopping cart",
  "timestamp": "2026-07-03T12:00:00.000Z",
  "relationships": {
    "requestId": "req_8f7b9c2a-e1d5",
    "traceId": "trace_8f7b9c2a-e1d5"
  },
  "tenant": {
    "organizationId": "org_authentitas",
    "projectId": "proj_prod_api",
    "environment": "production",
    "service": "authentitas-api"
  },
  "metadata": {
    "cartId": "cart_991823",
    "itemCount": 5,
    "totalAmount": 149.99
  }
}
```

#### Example B: Manual Error Log (Exception Category)
```json
{
  "version": "2.0.0",
  "category": "exception",
  "type": "exception",
  "action": "completed",
  "severity": "error",
  "message": "Failed to update user profile due to validation error",
  "timestamp": "2026-07-03T12:01:10.150Z",
  "relationships": {
    "requestId": "req_8f7b9c2a-e1d5",
    "traceId": "trace_8f7b9c2a-e1d5"
  },
  "tenant": {
    "organizationId": "org_authentitas",
    "projectId": "proj_prod_api",
    "environment": "production",
    "service": "authentitas-api"
  },
  "exception": {
    "name": "ValidationError",
    "message": "Email address already registered",
    "code": "409",
    "file": "src/controllers/user-controller.ts",
    "line": 42,
    "stack": "ValidationError: Email address already registered\n    at UserController.updateProfile (/app/src/controllers/user-controller.ts:42:15)\n    at Layer.handle [as handle_request] (/app/node_modules/express/lib/router/layer.js:95:5)"
  },
  "metadata": {
    "attemptedEmail": "user@example.com"
  }
}
```

---

## Case 2: Express Middleware (HTTP Requests & Responses)

### Trigger
Triggered automatically when mounting `logsenseMiddleware(sdk)` into an Express application. It monitors the HTTP request/response lifecycle.

### Captured Data
* **Incoming request (`request.incoming`)**:
  * Request method, path, and raw URL query params.
  * Extracted Request ID (correlated using headers like `x-request-id`, `x-trace-id`, or generated).
  * Client IP address and User-Agent.
  * Safe Request headers (key-value strings).
* **Completed request (`request.completed` / `request.slow`)**:
  * All incoming request properties.
  * Response HTTP Status Code.
  * Server processing duration (`durationMs`).
  * Response Content-Length.
  * Express Route path pattern (e.g., `/users/:id`).
  * Request Body (serialized as JSON; safely truncated to `5000` characters; files and buffers marked as `[Buffer]` or `[Stream]`).
  * Actor Context: Automatically parses auth token payloads (e.g. `req.user`, `req.tokenData`) for `actor.id`, `actor.name`, `actor.email`, and `actor.role`.
* **Unhandled Route Errors (`request.error`)**:
  * Error message, stack trace, and response status code of the crash.

### Payload Examples

#### Example A: Incoming HTTP Request
```json
{
  "version": "2.0.0",
  "category": "http",
  "type": "request.incoming",
  "action": "completed",
  "severity": "info",
  "message": "→ GET /api/users",
  "timestamp": "2026-07-03T12:05:00.100Z",
  "relationships": {
    "requestId": "req_84f93820-21a4-44b2",
    "traceId": "req_84f93820-21a4-44b2"
  },
  "tenant": {
    "organizationId": "org_authentitas",
    "projectId": "proj_prod_api",
    "environment": "production",
    "service": "authentitas-api"
  },
  "http": {
    "method": "GET",
    "url": "/api/users?role=admin&limit=10",
    "clientIp": "192.168.1.55",
    "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)...",
    "headers": {
      "host": "api.authentitas.com",
      "accept": "application/json",
      "x-request-id": "req_84f93820-21a4-44b2"
    },
    "query": {
      "role": "admin",
      "limit": "10"
    }
  }
}
```

#### Example B: Completed HTTP Response (With Actor Context & Request Body)
```json
{
  "version": "2.0.0",
  "category": "http",
  "type": "request.completed",
  "action": "completed",
  "severity": "info",
  "message": "← POST /api/users 201 (24ms)",
  "timestamp": "2026-07-03T12:05:00.124Z",
  "duration": 24,
  "relationships": {
    "requestId": "req_84f93820-21a4-44b2",
    "traceId": "req_84f93820-21a4-44b2"
  },
  "tenant": {
    "organizationId": "org_authentitas",
    "projectId": "proj_prod_api",
    "environment": "production",
    "service": "authentitas-api"
  },
  "actor": {
    "type": "user",
    "id": "usr_99218aef",
    "name": "Alex Admin",
    "email": "alex.admin@authentitas.com",
    "role": "admin"
  },
  "http": {
    "method": "POST",
    "url": "/api/users",
    "statusCode": 201,
    "route": "/api/users",
    "clientIp": "192.168.1.55",
    "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)...",
    "headers": {
      "host": "api.authentitas.com",
      "content-type": "application/json"
    },
    "body": {
      "username": "new_developer",
      "role": "developer",
      "email": "dev@authentitas.com"
    }
  },
  "metadata": {
    "statusCode": 201,
    "durationMs": 24,
    "contentLength": 182,
    "route": "/api/users"
  }
}
```

#### Example C: Slow HTTP Request warning (exceeding configured `slowThresholdMs`)
```json
{
  "version": "2.0.0",
  "category": "http",
  "type": "request.slow",
  "action": "completed",
  "severity": "warn",
  "message": "⚠ Slow request: GET /api/reports completed in 1200ms",
  "timestamp": "2026-07-03T12:06:12.300Z",
  "duration": 1200,
  "relationships": {
    "requestId": "req_11002233-4455-6677",
    "traceId": "req_11002233-4455-6677"
  },
  "tenant": {
    "organizationId": "org_authentitas",
    "projectId": "proj_prod_api",
    "environment": "production",
    "service": "authentitas-api"
  },
  "http": {
    "method": "GET",
    "url": "/api/reports",
    "statusCode": 200,
    "route": "/api/reports",
    "clientIp": "192.168.1.100",
    "userAgent": "curl/7.64.1"
  },
  "metadata": {
    "statusCode": 200,
    "durationMs": 1200,
    "slowThresholdMs": 1000
  }
}
```

---

## Case 3: Native HTTP Server Instrumentation

### Trigger
Triggered when running generic Node.js standard HTTP/HTTPS servers (or using frameworks like Fastify, Koa) with `HttpServerInstrumentation` registered.

### Captured Data
* **`request.started`**: Method, URL path, parsed query params, client IP, User-Agent, raw request headers.
* **`request.finished` / `request.failed`**: Status code, duration, response body chunk descriptors, response payload byte-size, error messages (if connection terminates abruptly).

### Payload Example (Request Finished)
```json
{
  "version": "2.0.0",
  "category": "http",
  "type": "request.finished",
  "action": "success",
  "severity": "info",
  "message": "Request Completed: GET /health - 200 (4ms)",
  "timestamp": "2026-07-03T12:08:00.005Z",
  "duration": 4,
  "relationships": {
    "requestId": "req_99bbcc88-22dd",
    "traceId": "trace_99bbcc88-22dd"
  },
  "tenant": {
    "organizationId": "org_authentitas",
    "projectId": "proj_prod_api",
    "environment": "production",
    "service": "authentitas-api"
  },
  "http": {
    "method": "GET",
    "url": "/health",
    "statusCode": 200,
    "responseSize": 18,
    "clientIp": "127.0.0.1",
    "userAgent": "kube-probe/1.22"
  }
}
```

---

## Case 4: Outgoing HTTP Client Request Instrumentation

### Trigger
Triggered automatically when calling any downstream external API using native `http.request`, `https.request`, or third-party wrappers like `axios`, `got`, or `fetch` (as long as `HttpClientInstrumentation` is enabled).

### Captured Data
* **Outgoing Call properties**: Downstream Method, complete remote request URL, duration of network request, response HTTP status code, success outcome boolean.
* **Trace Propagation**: Injects `x-trace-id`, `x-request-id`, and `x-span-id` request headers automatically to enable distributed tracing.
* **Errors**: Captures DNS resolution errors, TCP timeouts, or connection failures.

### Payload Example (Successful Downstream Request)
```json
{
  "version": "2.0.0",
  "category": "external",
  "type": "http.request",
  "action": "success",
  "severity": "info",
  "message": "HTTP POST https://api.stripe.com/v3/charges - 200",
  "timestamp": "2026-07-03T12:10:05.500Z",
  "duration": 185,
  "relationships": {
    "requestId": "req_84f93820-21a4-44b2",
    "traceId": "req_84f93820-21a4-44b2"
  },
  "tenant": {
    "organizationId": "org_authentitas",
    "projectId": "proj_prod_api",
    "environment": "production",
    "service": "authentitas-api"
  },
  "external": {
    "provider": "http",
    "method": "POST",
    "url": "https://api.stripe.com/v3/charges",
    "statusCode": 200,
    "success": true
  }
}
```

---

## Case 5: Database Query Instrumentation (Prisma, Mongoose, PostgreSQL, MySQL)

### Trigger
Triggered when executing database queries. The SDK instruments:
* **Prisma Client Extensions**
* **Mongoose Schema Plugins**
* **Native PostgreSQL (`pg`) client & pool query methods**
* **MySQL2 query methods**

### Captured Data
* Mapped Operation (`SELECT`, `INSERT`, `UPDATE`, `DELETE`, `CREATE`, `DROP`).
* Execution duration (`durationMs`) & Success status.
* Query SQL statement or Mongo query criteria object.
* Table or Collection name.
* Number of affected rows (for SQL drivers).
* **PII Redaction**: Parameter values in SQL queries are stripped (e.g. `WHERE email = $1`) to prevent logging credential inputs or PII.

### Payload Examples

#### Example A: Mongoose Query Event
```json
{
  "version": "2.0.0",
  "category": "database",
  "type": "db.query",
  "action": "completed",
  "severity": "info",
  "message": "Mongoose User.findOne succeeded",
  "timestamp": "2026-07-03T12:12:00.015Z",
  "duration": 12,
  "relationships": {
    "requestId": "req_84f93820-21a4-44b2",
    "traceId": "req_84f93820-21a4-44b2"
  },
  "tenant": {
    "organizationId": "org_authentitas",
    "projectId": "proj_prod_api",
    "environment": "production",
    "service": "authentitas-api"
  },
  "database": {
    "provider": "mongodb",
    "operation": "SELECT",
    "collection": "User",
    "success": true,
    "query": "{\"_id\":\"64a2b91f42e482319088ff21\"}"
  }
}
```

#### Example B: PostgreSQL Native Query Event
```json
{
  "version": "2.0.0",
  "category": "database",
  "type": "db.query",
  "action": "completed",
  "severity": "info",
  "message": "PG query SELECT succeeded",
  "timestamp": "2026-07-03T12:12:01.002Z",
  "duration": 5,
  "relationships": {
    "requestId": "req_84f93820-21a4-44b2",
    "traceId": "req_84f93820-21a4-44b2"
  },
  "tenant": {
    "organizationId": "org_authentitas",
    "projectId": "proj_prod_api",
    "environment": "production",
    "service": "authentitas-api"
  },
  "database": {
    "provider": "postgres",
    "operation": "SELECT",
    "success": true,
    "query": "SELECT name, email FROM users WHERE id = $1 AND active = $2",
    "rowsAffected": 1
  }
}
```

---

## Case 6: Redis Cache Operations Instrumentation

### Trigger
Triggered automatically when calling `get`, `set`, or `del` commands on wrapped Redis instances (`wrapRedisClient(redisClient, sdk.collector)`).

### Captured Data
* Redis Command name (GET, SET, DEL).
* Target cache key.
* Target hit outcomes (`hit: true` or `hit: false` for GET queries).
* Operation latency (milliseconds).
* Success / Error outcome tracking.

### Payload Example (Redis GET Miss)
```json
{
  "version": "2.0.0",
  "category": "cache",
  "type": "cache.operation",
  "action": "success",
  "severity": "info",
  "message": "Redis GET on \"session:usr_99218aef\" - MISS",
  "timestamp": "2026-07-03T12:15:00.002Z",
  "duration": 1,
  "relationships": {
    "requestId": "req_84f93820-21a4-44b2",
    "traceId": "req_84f93820-21a4-44b2"
  },
  "tenant": {
    "organizationId": "org_authentitas",
    "projectId": "proj_prod_api",
    "environment": "production",
    "service": "authentitas-api"
  },
  "cache": {
    "provider": "redis",
    "operation": "GET",
    "key": "session:usr_99218aef",
    "hit": false,
    "success": true
  }
}
```

---

## Case 7: Automatic Exception Capture (Uncaught & Unhandled)

### Trigger
Triggered automatically when the Node process catches critical system anomalies:
* `process.on('uncaughtException')`
* `process.on('unhandledRejection')`

### Captured Data
* Exception category metadata context: Exception class type (`name`), error message (`message`), stack trace, system file path, line numbers, error code (e.g. `ENOENT`).
* Triggers a synchronous flush of all queued telemetry logs to the LogSense server before shutting down, ensuring no logs are lost on crash.

### Payload Example (Uncaught Exception - System Level Fatal)
```json
{
  "version": "2.0.0",
  "category": "exception",
  "type": "uncaughtException",
  "action": "failed",
  "severity": "fatal",
  "message": "Cannot read properties of undefined (reading 'split')",
  "timestamp": "2026-07-03T12:20:00.050Z",
  "tenant": {
    "organizationId": "org_authentitas",
    "projectId": "proj_prod_api",
    "environment": "production",
    "service": "authentitas-api"
  },
  "exception": {
    "name": "TypeError",
    "message": "Cannot read properties of undefined (reading 'split')",
    "file": "src/utils/parser.ts",
    "line": 15,
    "stack": "TypeError: Cannot read properties of undefined (reading 'split')\n    at parseToken (/app/src/utils/parser.ts:15:28)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)"
  }
}
```

---

## Case 8: Runtime Metrics & Process Lifecycle Events

### Trigger
Triggered by the `RuntimeMonitor` subsystem:
* **Process Start (`process.start`)**: Collected at startup.
* **Process Exit (`process.exit`)**: Captured during process shutdown/exits (such as empty event loop or exit codes).
* **Process Signal Warnings (`SIGINT` / `SIGTERM`)**: Logged during process terminations.
* **Periodic Metrics (`metrics`)**: Dispatched automatically every `10` seconds.

### Captured Data
* **Startup / Shutdown**: System arch, OS platform, PID, Node runtime version.
* **Periodic Health Metrics**:
  * Host CPU utilization percentage.
  * System Memory Resident Set Size (RSS), Heap Total, and Heap Used.
  * Event loop delay metrics (measured using native `perf_hooks` loop latency monitor).

### Payload Examples

#### Example A: Process Signal Interrupt Log (SIGINT)
```json
{
  "version": "2.0.0",
  "category": "custom",
  "type": "process.sigint",
  "action": "completed",
  "severity": "warn",
  "message": "Process received SIGINT — initiating graceful shutdown",
  "timestamp": "2026-07-03T12:25:00.000Z",
  "tenant": {
    "organizationId": "org_authentitas",
    "projectId": "proj_prod_api",
    "environment": "production",
    "service": "authentitas-api"
  },
  "metadata": {
    "event": "process.sigint",
    "signal": "SIGINT",
    "pid": 4512
  }
}
```

#### Example B: Periodic Server Health Metrics Event
```json
{
  "version": "2.0.0",
  "category": "runtime",
  "type": "metrics",
  "action": "completed",
  "severity": "debug",
  "timestamp": "2026-07-03T12:25:10.000Z",
  "tenant": {
    "organizationId": "org_authentitas",
    "projectId": "proj_prod_api",
    "environment": "production",
    "service": "authentitas-api"
  },
  "runtimeMetrics": {
    "cpu": 12.45,
    "memory": 48219136,
    "heapUsed": 24901844,
    "heapTotal": 38100992,
    "eventLoopDelay": 0.82
  },
  "runtime": {
    "pid": 4512,
    "cpu": 12.45,
    "memory": 48219136
  }
}
```

---

## Case 9: Contextual Breadcrumbs Management

### Trigger
Triggered when breadcrumbs are logged via the global `breadcrumbManager.add({ message, level, category, metadata })`.

### Captured Data
* **Contextual Breadcrumbs**: If logged within an active execution trace context (e.g. Express Request handler), breadcrumbs are stored inside the active request's context store (`metadata._breadcrumbs`). When a log is dispatched in that trace (e.g., an error or response), the log includes the array of breadcrumbs.
* **Global Breadcrumbs**: Out-of-context breadcrumbs are stored in a rolling global buffer (limit of `100`).

### Payload Example (Request Completed Log Containing Appended Breadcrumbs)
Below is an example of an HTTP completion event enriched with contextual breadcrumbs recorded prior to the response:

```json
{
  "version": "2.0.0",
  "category": "http",
  "type": "request.completed",
  "action": "completed",
  "severity": "info",
  "message": "← GET /api/v1/profile 200 (15ms)",
  "timestamp": "2026-07-03T12:30:00.015Z",
  "duration": 15,
  "relationships": {
    "requestId": "req_84f93820-21a4-44b2",
    "traceId": "req_84f93820-21a4-44b2"
  },
  "tenant": {
    "organizationId": "org_authentitas",
    "projectId": "proj_prod_api",
    "environment": "production",
    "service": "authentitas-api"
  },
  "http": {
    "method": "GET",
    "url": "/api/v1/profile",
    "statusCode": 200,
    "route": "/api/v1/profile",
    "clientIp": "192.168.1.55",
    "userAgent": "Mozilla/5.0..."
  },
  "metadata": {
    "statusCode": 200,
    "durationMs": 15,
    "_breadcrumbs": [
      {
        "timestamp": 1782217799980,
        "message": "Retrieving session token from cookie store",
        "category": "auth",
        "level": "info"
      },
      {
        "timestamp": 1782217800000,
        "message": "User session validated successfully",
        "category": "auth",
        "level": "info",
        "metadata": { "userId": "usr_99218aef" }
      },
      {
        "timestamp": 1782217800005,
        "message": "Querying profile details from database",
        "category": "db",
        "level": "debug"
      }
    ]
  }
}
```
