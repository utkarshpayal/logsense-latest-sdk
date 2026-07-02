# API Reference

This page lists the public TypeScript interfaces, types, and method signatures for the LogSense SDK.

---

# Core Types & Interfaces

```typescript
export interface SDKConfig {
  /**
   * Secret credential token to authorize client telemetry payloads.
   */
  apiKey: string;

  /**
   * Name of the active microservice or application tier.
   */
  service: string;

  /**
   * Organization namespace identifier.
   */
  organizationId: string;

  /**
   * Target project workspace identifier.
   */
  projectId: string;

  /**
   * Target endpoint where events are posted.
   * @default "https://api.logsense.com/v1/events"
   */
  endpoint?: string;

  /**
   * Deployment environment level.
   * @default "development"
   */
  environment?: string;

  /**
   * Application release tag or build identifier.
   */
  serviceVersion?: string;

  /**
   * Maximum events consolidated in a single batch transmission.
   * @default 100
   */
  batchSize?: number;

  /**
   * Timeout in milliseconds for logging batch dispatches.
   * @default 5000
   */
  flushInterval?: number;

  /**
   * Maximum queue limit threshold for memory buffering.
   * @default 10000
   */
  maxQueueSize?: number;

  /**
   * Enable writing telemetry to disk buffer when servers are offline.
   * @default false
   */
  diskQueueEnabled?: boolean;

  /**
   * Target path for SQLite disk buffering database.
   * @default "./.logsense/queue"
   */
  diskQueueDir?: string;

  /**
   * Disables automated instrumentation patching.
   * @default false
   */
  disableInstrumentation?: boolean;

  /**
   * Telemetry configuration profile preset.
   */
  profile?: "production" | "development" | "testing" | "serverless";

  /**
   * Custom telemetry processing interceptors.
   */
  processors?: Array<(event: LogEvent) => LogEvent | null>;
}
```

---

# `LogSenseClient` Class

```typescript
import { ProductionLogger } from "./logger";
import { Collector } from "../collector/collector";

export class LogSenseClient {
  /**
   * The primary logger instance for manual log creation.
   */
  public readonly logger: ProductionLogger;

  /**
   * Internal collector that manages event validation and pipeline processing.
   */
  public readonly collector: Collector;

  constructor(config: SDKConfig);

  /**
   * Force an immediate network flush of all queued events.
   */
  public flush(): Promise<void>;

  /**
   * Gracefully shut down the SDK client.
   * Flushes active queues, stops background timers, and unbinds process listeners.
   */
  public shutdown(): Promise<void>;
}

// Named export alias matching preferred setup imports
export { LogSenseClient as LogSense };
```

---

# `ProductionLogger` Class

```typescript
export class ProductionLogger {
  /**
   * Log an informational message.
   */
  public info(message: string, metadata?: Record<string, any>): void;

  /**
   * Log a diagnostic debug message.
   */
  public debug(message: string, metadata?: Record<string, any>): void;

  /**
   * Log a warning message.
   */
  public warn(message: string, metadata?: Record<string, any>): void;

  /**
   * Log an error message.
   */
  public error(message: string, metadata?: Record<string, any>): void;

  /**
   * Capture a JavaScript error object with stack trace analysis.
   */
  public captureException(error: Error, metadata?: Record<string, any>): void;

  /**
   * Create a child logger instance that inherits the provided metadata.
   */
  public child(metadata: Record<string, any>): ProductionLogger;
}
```

---

# Express Middleware Factory

```typescript
import { RequestHandler, ErrorRequestHandler } from "express";
import { LogSenseClient } from "../core/sdk";

export interface MiddlewareOptions {
  /**
   * Duration threshold in milliseconds that flags a request as slow.
   * @default 300
   */
  slowThresholdMs?: number;

  /**
   * Custom metadata fields appended to all request/response telemetry.
   */
  metadata?: Record<string, any>;

  /**
   * Endpoints excluded from telemetry collection.
   */
  ignoreRoutes?: string[];
}

/**
 * Returns a tuple containing the request handler and error handler.
 */
export function logsenseMiddleware(
  sdk: LogSenseClient,
  options?: MiddlewareOptions
): [RequestHandler, ErrorRequestHandler];
```

---

# Instrumentation Utilities

```typescript
import { Collector } from "../collector/collector";

/**
 * Decorates a pg client or pool object to auto-log queries.
 */
export function wrapPg(pgClientOrPool: any, collector: Collector): void;

/**
 * Decorates a mysql2 client or pool object to auto-log queries.
 */
export function wrapMysql2(mysqlConnectionOrPool: any, collector: Collector): void;

/**
 * Mongoose schema-level plugin that auto-logs database operations.
 */
export function mongooseLogSensePlugin(schema: any, options: { collector: Collector }): void;

/**
 * Prisma Client Extension that auto-logs database queries.
 */
export function prismaLogSenseExtension(collector: Collector, provider?: string): any;
```
