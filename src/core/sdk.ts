import { buildConfig, SDKConfig, validateConfig } from "./config";
import { Collector } from "../collector/collector";
import { EventBuilder } from "../event/builder";
import { EventQueue } from "../queue/queue";
import { MemoryQueue } from "../queue/memory-queue";
import { DiskQueue } from "../queue/disk-queue";
import { HttpTransport } from "../transport/http-transport";
import { BatchManager } from "../batch/batch-manager";
import { RetryManager } from "../retry/retry-manager";
import { createBackoffStrategy } from "../retry/backoff";
import { MemoryDeadLetterQueue, DeadLetterQueue } from "../retry/dlq";
import { LogSenseLogger, ProductionLogger } from "../logger/logger";
import { MaskingProcessor } from "../pipeline/processors/masking";
import { SamplingProcessor } from "../pipeline/processors/sampling";
import { ExceptionCapture } from "../instrumentation/exception-capture";
import { RuntimeMonitor } from "../instrumentation/runtime-monitor";
import { HttpClientInstrumentation } from "../instrumentation/http-client-instrumentation";
import { HttpServerInstrumentation } from "../instrumentation/http-instrumentation";
import { HealthMonitor } from "../monitoring/health";
import { metricsCollector } from "../monitoring/metrics";
import { Environment, EventCategory, EventStatus, Severity, ActorType } from "../event/constants";
import { contextStore } from "../context/context-store";
import { sessionManager, Session } from "../session";
import { breadcrumbManager } from "../breadcrumbs";
import { EnrichmentProcessor } from "../pipeline/processors/enrichment";
import { FingerprintProcessor } from "../pipeline/processors/fingerprint";
import { LogSensePlugin } from "../pipeline/plugin";
import { spanManager } from "../tracing/span-manager";
import { EventProcessor } from "../pipeline/processor";

let globalClient: LogSenseClient | null = null;

export class LogSenseClient {
    public readonly config: ReturnType<typeof buildConfig>;
    public readonly queue: EventQueue;
    public readonly transport: HttpTransport;
    public readonly retryManager: RetryManager;
    public readonly dlq: DeadLetterQueue;
    public readonly batchManager: BatchManager;
    public readonly builder: EventBuilder;
    public readonly collector: Collector;
    public readonly logger: LogSenseLogger;
    public readonly healthMonitor: HealthMonitor;

    private readonly exceptionCapture: ExceptionCapture;
    private readonly runtimeMonitor: RuntimeMonitor;
    private readonly httpClientInstrumentation: HttpClientInstrumentation;
    private readonly httpServerInstrumentation: HttpServerInstrumentation;

    private isShutDown = false;

    constructor(userConfig?: SDKConfig) {
        // 1. Build and validate configuration
        this.config = buildConfig(userConfig);
        validateConfig(this.config);

        // 2. Instantiate Queue (Memory or Disk)
        if (this.config.diskQueueEnabled) {
            const diskQueue = new DiskQueue({
                queueDir: this.config.diskQueueDir,
                maxSize: this.config.batchSize * 10, // queue limit
            });
            // Initialize disk queue synchronously via async promise hook (handling it gracefully)
            this.queue = diskQueue;
            void diskQueue.init().catch((err) => {
                console.error("[LogSense] Failed to initialize DiskQueue:", err);
            });
        } else {
            this.queue = new MemoryQueue({
                maxSize: 5000,
            });
        }

        // 3. Instantiate Transport
        this.transport = new HttpTransport({
            endpoint: this.config.endpoint,
            apiKey: this.config.apiKey!,
            timeout: 10000,
        });

        // 4. Instantiate Retry Manager and DLQ
        const lifecyclePlugins: LogSensePlugin[] = [];
        this.dlq = new MemoryDeadLetterQueue();
        const backoffStrategy = createBackoffStrategy(
            this.config.retry.backoffType,
            this.config.retry.baseDelayMs,
            this.config.retry.maxDelayMs,
        );
        this.retryManager = new RetryManager({
            transport: this.transport,
            backoffStrategy,
            dlq: this.dlq,
            maxAttempts: this.config.retry.maxAttempts,
            debug: this.config.debug,
            plugins: lifecyclePlugins,
        });

        // 5. Instantiate Batch Manager
        this.batchManager = new BatchManager({
            queue: this.queue,
            transport: this.transport,
            retryManager: this.retryManager,
            maxBatchSize: this.config.batchSize,
            flushInterval: this.config.flushInterval,
            plugins: lifecyclePlugins,
        });

        // 6. Instantiate Event Builder
        this.builder = new EventBuilder({
            sdkVersion: "1.0.0",
            tenant: {
                organizationId: this.config.organizationId!,
                projectId: this.config.projectId!,
                environment: this.config.environment as Environment,
                service: this.config.service!,
                ...(this.config.serviceVersion ? { serviceVersion: this.config.serviceVersion } : {}),
            },
        });

        // 7. Instantiate Collector
        this.collector = new Collector({
            builder: this.builder,
            queue: this.queue,
            batchManager: this.batchManager,
            plugins: lifecyclePlugins,
        });

        // Initialize spanManager with collector
        spanManager.setCollector(this.collector);

        // Register default processors: enrichment and fingerprinting
        this.collector.use(
            new EnrichmentProcessor({
                sdkVersion: "1.0.0",
                ...(this.config.serviceVersion !== undefined ? { releaseVersion: this.config.serviceVersion } : {}),
            })
        );
        this.collector.use(new FingerprintProcessor());

        // 8. Register Pipeline Processors (Sampling, Masking, Plugins)
        if (this.config.sampling) {
            this.collector.use(
                new SamplingProcessor({
                    ...(this.config.sampling.type !== undefined ? { strategy: this.config.sampling.type } : {}),
                    ...(this.config.sampling.rate !== undefined ? { rate: this.config.sampling.rate } : {}),
                    ...(this.config.sampling.windowSizeMs !== undefined ? { windowSizeMs: this.config.sampling.windowSizeMs } : {}),
                    ...(this.config.sampling.maxEventsPerWindow !== undefined ? { maxEventsPerWindow: this.config.sampling.maxEventsPerWindow } : {}),
                }),
            );
        }

        if (this.config.masking?.enabled) {
            this.collector.use(
                new MaskingProcessor({
                    enabled: this.config.masking.enabled,
                    keys: this.config.masking.keys,
                    patterns: this.config.masking.patterns,
                }),
            );
        }

        if (this.config.plugins && this.config.plugins.length > 0) {
            for (const p of this.config.plugins) {
                this.collector.use(p);
            }
        }

        // 9. Instantiate Production Logger
        this.logger = new ProductionLogger(this.collector, this.config.debug);

        // 10. Instantiate Health Monitor
        this.healthMonitor = new HealthMonitor({
            queue: this.queue,
            retryManager: this.retryManager,
            metrics: metricsCollector,
        });

        // 11. Instantiate Instrumentations
        this.exceptionCapture = new ExceptionCapture({
            collector: this.collector,
            onShutdown: () => this.shutdown(),
            debug: this.config.debug,
        });

        this.runtimeMonitor = new RuntimeMonitor({
            collector: this.collector,
            intervalMs: 10000,
            debug: this.config.debug,
        });

        this.httpClientInstrumentation = new HttpClientInstrumentation({
            collector: this.collector,
            sdkEndpoint: this.config.endpoint,
            debug: this.config.debug,
        });

        this.httpServerInstrumentation = new HttpServerInstrumentation({
            collector: this.collector,
            tenant: {
                organizationId: this.config.organizationId!,
                projectId: this.config.projectId!,
                environment: this.config.environment as Environment,
                service: this.config.service!,
                ...(this.config.serviceVersion ? { serviceVersion: this.config.serviceVersion } : {}),
            },
            debug: this.config.debug,
        });

        // 12. Start internal operations and instrumentations
        this.batchManager.start();

        if (!this.config.disableInstrumentation) {
            this.exceptionCapture.register();
            this.runtimeMonitor.start();
            this.httpClientInstrumentation.register();
            this.httpServerInstrumentation.register();
        }
    }

    /**
     * Register a lifecycle plugin or custom processor.
     */
    use(plugin: LogSensePlugin | EventProcessor): this {
        this.collector.use(plugin);
        return this;
    }

    /**
     * Gracefully shutdown the SDK: stop timers, flush queue, retry remaining, close transport.
     */
    async shutdown(): Promise<void> {
        if (this.isShutDown) {
            return;
        }
        this.isShutDown = true;

        if (this.config.debug) {
            console.log("[LogSense] Starting graceful SDK shutdown...");
        }

        // Stop instrumentations
        this.exceptionCapture.unregister();
        this.runtimeMonitor.stop();
        this.httpClientInstrumentation.unregister();
        this.httpServerInstrumentation.unregister();

        // Flush and stop BatchManager (which closes transport)
        await this.batchManager.shutdown();

        // Shutdown RetryManager (cancels pending timers and retrieves aborted events)
        const abortedEvents = await this.retryManager.shutdown();
        if (abortedEvents.length > 0) {
            if (this.config.debug) {
                console.log(`[LogSense] Re-queueing ${abortedEvents.length} pending events during shutdown.`);
            }
            await this.queue.enqueueMany(abortedEvents);
        }

        if (this.config.debug) {
            console.log("[LogSense] SDK shutdown complete.");
        }
    }
}

// Fallback logger to prevent crashes before initialization
const fallbackLogger: LogSenseLogger = {
    trace: (msg, meta) => console.log(`[LogSense Offline] [TRACE] ${msg}`, meta || ""),
    debug: (msg, meta) => console.log(`[LogSense Offline] [DEBUG] ${msg}`, meta || ""),
    info: (msg, meta) => console.log(`[LogSense Offline] [INFO] ${msg}`, meta || ""),
    warn: (msg, meta) => console.warn(`[LogSense Offline] [WARN] ${msg}`, meta || ""),
    error: (msg, err, meta) => console.error(`[LogSense Offline] [ERROR] ${msg}`, err || "", meta || ""),
    fatal: (msg, err, meta) => console.error(`[LogSense Offline] [FATAL] ${msg}`, err || "", meta || ""),
};

// Global public API
export const logsense = {
    init(config?: SDKConfig): LogSenseClient {
        if (globalClient) {
            if (globalClient.config.debug) {
                console.warn("[LogSense] SDK is already initialized.");
            }
            return globalClient;
        }
        globalClient = new LogSenseClient(config);
        return globalClient;
    },

    async shutdown(): Promise<void> {
        if (!globalClient) {
            return;
        }
        const client = globalClient;
        globalClient = null;
        await client.shutdown();
    },

    async track(partialEvent: any): Promise<any> {
        if (!globalClient) {
            console.error("[LogSense] SDK not initialized. Call init() first.");
            return null;
        }
        metricsCollector.recordEventProcessed();

        const activeCtx = contextStore.get();
        const relationships = activeCtx
            ? {
                  traceId: activeCtx.traceId,
                  requestId: activeCtx.requestId,
                  ...(activeCtx.spanId ? { spanId: activeCtx.spanId } : {}),
                  ...(activeCtx.sessionId ? { sessionId: activeCtx.sessionId } : {}),
                  ...partialEvent.relationships,
              }
            : partialEvent.relationships;

        const eventWithCtx = relationships
            ? { ...partialEvent, relationships }
            : partialEvent;

        return globalClient.collector.collect(eventWithCtx);
    },

    async captureException(error: Error | unknown): Promise<any> {
        if (!globalClient) {
            console.error("[LogSense] SDK not initialized. Call init() first.");
            return null;
        }
        metricsCollector.recordEventProcessed();
        const err = error instanceof Error ? error : new Error(String(error));
        const exceptionContext: any = {
            name: err.name || "Error",
            message: err.message || "Unknown error",
        };
        if (err.stack) {
            exceptionContext.stack = err.stack;
        }

        const breadcrumbs = breadcrumbManager.get();
        if (breadcrumbs && breadcrumbs.length > 0) {
            exceptionContext.breadcrumbs = [...breadcrumbs];
        }

        const activeCtx = contextStore.get();
        const relationships = activeCtx
            ? {
                  traceId: activeCtx.traceId,
                  requestId: activeCtx.requestId,
                  ...(activeCtx.spanId ? { spanId: activeCtx.spanId } : {}),
                  ...(activeCtx.sessionId ? { sessionId: activeCtx.sessionId } : {}),
              }
            : undefined;

        return globalClient.collector.collect<any>({
            category: EventCategory.EXCEPTION,
            type: "exception",
            action: EventStatus.FAILED,
            severity: Severity.ERROR,
            message: err.message || "Captured Exception",
            exception: exceptionContext,
            ...(relationships ? { relationships } : {}),
        });
    },

    trace<T>(name: string, fn: (span: any) => T | Promise<T>): T | Promise<T> {
        if (!globalClient) {
            throw new Error("[LogSense] SDK not initialized. Call init() first.");
        }
        const span = spanManager.startSpan(name);
        return spanManager.withSpan(span, () => {
            try {
                const result = fn(span);
                if (result instanceof Promise) {
                    return result.then(
                        (res) => {
                            span.end();
                            return res;
                        },
                        (err) => {
                            span.recordException(err);
                            span.end();
                            throw err;
                        }
                    );
                }
                span.end();
                return result;
            } catch (err) {
                span.recordException(err);
                span.end();
                throw err;
            }
        });
    },

    startSpan(name: string, options?: any): any {
        if (!globalClient) {
            throw new Error("[LogSense] SDK not initialized. Call init() first.");
        }
        return spanManager.startSpan(name, options);
    },

    get logger(): LogSenseLogger {
        if (!globalClient) {
            return fallbackLogger;
        }
        return globalClient.logger;
    },

    get client(): LogSenseClient | null {
        return globalClient;
    },

    identify(userId: string, userMetadata?: Record<string, any>): void {
        const activeCtx = contextStore.get();
        if (activeCtx) {
            activeCtx.actor = {
                type: ActorType.USER,
                id: userId,
                name: userMetadata?.name,
                email: userMetadata?.email,
                role: userMetadata?.role,
            };
            let sessionId = activeCtx.sessionId;
            if (!sessionId) {
                const session = sessionManager.createSession(userId, userMetadata);
                activeCtx.sessionId = session.sessionId;
            } else {
                const session = sessionManager.reconstructSession(sessionId);
                session.identify(userId, userMetadata);
            }
        }
    },

    setUser(user: { id: string; email?: string; name?: string; role?: string; metadata?: Record<string, any> }): void {
        const activeCtx = contextStore.get();
        if (activeCtx) {
            activeCtx.actor = {
                type: ActorType.USER,
                id: user.id,
                ...(user.name !== undefined ? { name: user.name } : {}),
                ...(user.email !== undefined ? { email: user.email } : {}),
                ...(user.role !== undefined ? { role: user.role } : {}),
            };
            if (user.metadata) {
                activeCtx.metadata.userMetadata = user.metadata;
            }
        }
    },

    setOrganization(orgId: string): void {
        const activeCtx = contextStore.get();
        if (activeCtx) {
            activeCtx.tenant.organizationId = orgId;
        }
    },

    setWorkspace(workspaceId: string): void {
        const activeCtx = contextStore.get();
        if (activeCtx) {
            activeCtx.tenant.projectId = workspaceId;
            activeCtx.metadata.workspaceId = workspaceId;
        }
    },

    clearIdentity(): void {
        const activeCtx = contextStore.get();
        if (activeCtx) {
            delete activeCtx.actor;
            delete activeCtx.sessionId;
        }
    },

    resetIdentity(): void {
        const activeCtx = contextStore.get();
        if (activeCtx) {
            delete activeCtx.actor;
            const session = sessionManager.createSession();
            activeCtx.sessionId = session.sessionId;
        }
    },

    currentSession(): Session | undefined {
        return sessionManager.currentSession();
    },

    async trackBusinessEvent(name: string, metadata?: Record<string, any>): Promise<any> {
        return this.track({
            category: EventCategory.BUSINESS,
            type: "business",
            action: name,
            severity: Severity.INFO,
            message: `Business Event: ${name}`,
            metadata: metadata || {},
        });
    },

    business: {
        async orderCreated(orderId: string, amount: number, currency: string, metadata?: Record<string, any>): Promise<any> {
            return logsense.trackBusinessEvent("order.created", {
                orderId,
                amount,
                currency,
                ...metadata,
            });
        },

        async paymentSucceeded(paymentId: string, amount: number, currency: string, metadata?: Record<string, any>): Promise<any> {
            return logsense.trackBusinessEvent("payment.succeeded", {
                paymentId,
                amount,
                currency,
                ...metadata,
            });
        },

        async userRegistered(userId: string, email: string, metadata?: Record<string, any>): Promise<any> {
            return logsense.trackBusinessEvent("user.registered", {
                userId,
                email,
                ...metadata,
            });
        },

        async subscriptionRenewed(subscriptionId: string, plan: string, amount: number, metadata?: Record<string, any>): Promise<any> {
            return logsense.trackBusinessEvent("subscription.renewed", {
                subscriptionId,
                plan,
                amount,
                ...metadata,
            });
        },
    },

    metrics(): Record<string, any> | null {
        if (globalClient) {
            const queue = globalClient.queue;
            const memoryQueueSize = queue instanceof MemoryQueue ? queue.size() : 0;
            const diskQueueSize = queue instanceof DiskQueue ? queue.size() : 0;
            return {
                queueSize: queue.size(),
                retries: metricsCollector.getRetryCount(),
                transportFailures: metricsCollector.getTransportFailureCount(),
                droppedEvents: metricsCollector.getEventsDropped(),
                averageBatchSize: metricsCollector.getAverageBatchSize(),
                eventsPerSecond: metricsCollector.getEventsPerSecond(),
                flushCount: metricsCollector.getFlushCount(),
                averageLatency: metricsCollector.getAverageTransportLatency(),
                memoryQueueSize,
                diskQueueSize,
            };
        }
        return null;
    },

    health(): any | null {
        if (globalClient) {
            return globalClient.healthMonitor.getHealth();
        }
        return null;
    },

    use(plugin: LogSensePlugin | EventProcessor): void {
        if (globalClient) {
            globalClient.use(plugin);
        }
    },
};
