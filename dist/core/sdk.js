"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logsense = exports.LogSenseClient = void 0;
const config_1 = require("./config");
const collector_1 = require("../collector/collector");
const builder_1 = require("../event/builder");
const memory_queue_1 = require("../queue/memory-queue");
const disk_queue_1 = require("../queue/disk-queue");
const http_transport_1 = require("../transport/http-transport");
const batch_manager_1 = require("../batch/batch-manager");
const retry_manager_1 = require("../retry/retry-manager");
const backoff_1 = require("../retry/backoff");
const dlq_1 = require("../retry/dlq");
const logger_1 = require("../logger/logger");
const masking_1 = require("../pipeline/processors/masking");
const sampling_1 = require("../pipeline/processors/sampling");
const exception_capture_1 = require("../instrumentation/exception-capture");
const runtime_monitor_1 = require("../instrumentation/runtime-monitor");
const http_client_instrumentation_1 = require("../instrumentation/http-client-instrumentation");
const http_instrumentation_1 = require("../instrumentation/http-instrumentation");
const health_1 = require("../monitoring/health");
const metrics_1 = require("../monitoring/metrics");
const constants_1 = require("../event/constants");
const context_store_1 = require("../context/context-store");
const session_1 = require("../session");
const breadcrumbs_1 = require("../breadcrumbs");
const enrichment_1 = require("../pipeline/processors/enrichment");
const fingerprint_1 = require("../pipeline/processors/fingerprint");
const span_manager_1 = require("../tracing/span-manager");
let globalClient = null;
class LogSenseClient {
    config;
    queue;
    transport;
    retryManager;
    dlq;
    batchManager;
    builder;
    collector;
    logger;
    healthMonitor;
    exceptionCapture;
    runtimeMonitor;
    httpClientInstrumentation;
    httpServerInstrumentation;
    isShutDown = false;
    constructor(userConfig) {
        // 1. Build and validate configuration
        this.config = (0, config_1.buildConfig)(userConfig);
        (0, config_1.validateConfig)(this.config);
        // 2. Instantiate Queue (Memory or Disk)
        if (this.config.diskQueueEnabled) {
            const diskQueue = new disk_queue_1.DiskQueue({
                queueDir: this.config.diskQueueDir,
                maxSize: this.config.batchSize * 10, // queue limit
            });
            // Initialize disk queue synchronously via async promise hook (handling it gracefully)
            this.queue = diskQueue;
            void diskQueue.init().catch((err) => {
                console.error("[LogSense] Failed to initialize DiskQueue:", err);
            });
        }
        else {
            this.queue = new memory_queue_1.MemoryQueue({
                maxSize: 5000,
            });
        }
        // 3. Instantiate Transport
        this.transport = new http_transport_1.HttpTransport({
            endpoint: this.config.endpoint,
            apiKey: this.config.apiKey,
            timeout: 10000,
        });
        // 4. Instantiate Retry Manager and DLQ
        const lifecyclePlugins = [];
        this.dlq = new dlq_1.MemoryDeadLetterQueue();
        const backoffStrategy = (0, backoff_1.createBackoffStrategy)(this.config.retry.backoffType, this.config.retry.baseDelayMs, this.config.retry.maxDelayMs);
        this.retryManager = new retry_manager_1.RetryManager({
            transport: this.transport,
            backoffStrategy,
            dlq: this.dlq,
            maxAttempts: this.config.retry.maxAttempts,
            debug: this.config.debug,
            plugins: lifecyclePlugins,
        });
        // 5. Instantiate Batch Manager
        this.batchManager = new batch_manager_1.BatchManager({
            queue: this.queue,
            transport: this.transport,
            retryManager: this.retryManager,
            maxBatchSize: this.config.batchSize,
            flushInterval: this.config.flushInterval,
            plugins: lifecyclePlugins,
        });
        // 6. Instantiate Event Builder
        this.builder = new builder_1.EventBuilder({
            sdkVersion: "1.0.0",
            tenant: {
                organizationId: this.config.organizationId,
                projectId: this.config.projectId,
                environment: this.config.environment,
                service: this.config.service,
                ...(this.config.serviceVersion ? { serviceVersion: this.config.serviceVersion } : {}),
            },
        });
        // 7. Instantiate Collector
        this.collector = new collector_1.Collector({
            builder: this.builder,
            queue: this.queue,
            batchManager: this.batchManager,
            plugins: lifecyclePlugins,
        });
        // Initialize spanManager with collector
        span_manager_1.spanManager.setCollector(this.collector);
        // Register default processors: enrichment and fingerprinting
        this.collector.use(new enrichment_1.EnrichmentProcessor({
            sdkVersion: "1.0.0",
            ...(this.config.serviceVersion !== undefined ? { releaseVersion: this.config.serviceVersion } : {}),
        }));
        this.collector.use(new fingerprint_1.FingerprintProcessor());
        // 8. Register Pipeline Processors (Sampling, Masking, Plugins)
        if (this.config.sampling) {
            this.collector.use(new sampling_1.SamplingProcessor({
                ...(this.config.sampling.type !== undefined ? { strategy: this.config.sampling.type } : {}),
                ...(this.config.sampling.rate !== undefined ? { rate: this.config.sampling.rate } : {}),
                ...(this.config.sampling.windowSizeMs !== undefined ? { windowSizeMs: this.config.sampling.windowSizeMs } : {}),
                ...(this.config.sampling.maxEventsPerWindow !== undefined ? { maxEventsPerWindow: this.config.sampling.maxEventsPerWindow } : {}),
            }));
        }
        if (this.config.masking?.enabled) {
            this.collector.use(new masking_1.MaskingProcessor({
                enabled: this.config.masking.enabled,
                keys: this.config.masking.keys,
                patterns: this.config.masking.patterns,
            }));
        }
        if (this.config.plugins && this.config.plugins.length > 0) {
            for (const p of this.config.plugins) {
                this.collector.use(p);
            }
        }
        // 9. Instantiate Production Logger
        this.logger = new logger_1.ProductionLogger(this.collector, this.config.debug);
        // 10. Instantiate Health Monitor
        this.healthMonitor = new health_1.HealthMonitor({
            queue: this.queue,
            retryManager: this.retryManager,
            metrics: metrics_1.metricsCollector,
        });
        // 11. Instantiate Instrumentations
        this.exceptionCapture = new exception_capture_1.ExceptionCapture({
            collector: this.collector,
            onShutdown: () => this.shutdown(),
            debug: this.config.debug,
        });
        this.runtimeMonitor = new runtime_monitor_1.RuntimeMonitor({
            collector: this.collector,
            intervalMs: this.config.metricsIntervalMs,
            debug: this.config.debug,
        });
        this.httpClientInstrumentation = new http_client_instrumentation_1.HttpClientInstrumentation({
            collector: this.collector,
            sdkEndpoint: this.config.endpoint,
            debug: this.config.debug,
        });
        this.httpServerInstrumentation = new http_instrumentation_1.HttpServerInstrumentation({
            collector: this.collector,
            tenant: {
                organizationId: this.config.organizationId,
                projectId: this.config.projectId,
                environment: this.config.environment,
                service: this.config.service,
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
    use(plugin) {
        this.collector.use(plugin);
        return this;
    }
    /**
     * Gracefully shutdown the SDK: stop timers, flush queue, retry remaining, close transport.
     */
    async shutdown() {
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
exports.LogSenseClient = LogSenseClient;
// Fallback logger to prevent crashes before initialization
const fallbackLogger = {
    trace: (msg, meta) => console.log(`[LogSense Offline] [TRACE] ${msg}`, meta || ""),
    debug: (msg, meta) => console.log(`[LogSense Offline] [DEBUG] ${msg}`, meta || ""),
    info: (msg, meta) => console.log(`[LogSense Offline] [INFO] ${msg}`, meta || ""),
    warn: (msg, meta) => console.warn(`[LogSense Offline] [WARN] ${msg}`, meta || ""),
    error: (msg, err, meta) => console.error(`[LogSense Offline] [ERROR] ${msg}`, err || "", meta || ""),
    fatal: (msg, err, meta) => console.error(`[LogSense Offline] [FATAL] ${msg}`, err || "", meta || ""),
};
// Global public API
exports.logsense = {
    init(config) {
        if (globalClient) {
            if (globalClient.config.debug) {
                console.warn("[LogSense] SDK is already initialized.");
            }
            return globalClient;
        }
        globalClient = new LogSenseClient(config);
        return globalClient;
    },
    async shutdown() {
        if (!globalClient) {
            return;
        }
        const client = globalClient;
        globalClient = null;
        await client.shutdown();
    },
    async track(partialEvent) {
        if (!globalClient) {
            console.error("[LogSense] SDK not initialized. Call init() first.");
            return null;
        }
        metrics_1.metricsCollector.recordEventProcessed();
        const activeCtx = context_store_1.contextStore.get();
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
    async captureException(error) {
        if (!globalClient) {
            console.error("[LogSense] SDK not initialized. Call init() first.");
            return null;
        }
        metrics_1.metricsCollector.recordEventProcessed();
        const err = error instanceof Error ? error : new Error(String(error));
        const exceptionContext = {
            name: err.name || "Error",
            message: err.message || "Unknown error",
        };
        if (err.stack) {
            exceptionContext.stack = err.stack;
        }
        const breadcrumbs = breadcrumbs_1.breadcrumbManager.get();
        if (breadcrumbs && breadcrumbs.length > 0) {
            exceptionContext.breadcrumbs = [...breadcrumbs];
        }
        const activeCtx = context_store_1.contextStore.get();
        const relationships = activeCtx
            ? {
                traceId: activeCtx.traceId,
                requestId: activeCtx.requestId,
                ...(activeCtx.spanId ? { spanId: activeCtx.spanId } : {}),
                ...(activeCtx.sessionId ? { sessionId: activeCtx.sessionId } : {}),
            }
            : undefined;
        return globalClient.collector.collect({
            category: constants_1.EventCategory.EXCEPTION,
            type: "exception",
            action: constants_1.EventStatus.FAILED,
            severity: constants_1.Severity.ERROR,
            message: err.message || "Captured Exception",
            exception: exceptionContext,
            ...(relationships ? { relationships } : {}),
        });
    },
    trace(name, fn) {
        if (!globalClient) {
            throw new Error("[LogSense] SDK not initialized. Call init() first.");
        }
        const span = span_manager_1.spanManager.startSpan(name);
        return span_manager_1.spanManager.withSpan(span, () => {
            try {
                const result = fn(span);
                if (result instanceof Promise) {
                    return result.then((res) => {
                        span.end();
                        return res;
                    }, (err) => {
                        span.recordException(err);
                        span.end();
                        throw err;
                    });
                }
                span.end();
                return result;
            }
            catch (err) {
                span.recordException(err);
                span.end();
                throw err;
            }
        });
    },
    startSpan(name, options) {
        if (!globalClient) {
            throw new Error("[LogSense] SDK not initialized. Call init() first.");
        }
        return span_manager_1.spanManager.startSpan(name, options);
    },
    get logger() {
        if (!globalClient) {
            return fallbackLogger;
        }
        return globalClient.logger;
    },
    get client() {
        return globalClient;
    },
    identify(userId, userMetadata) {
        const activeCtx = context_store_1.contextStore.get();
        if (activeCtx) {
            activeCtx.actor = {
                type: constants_1.ActorType.USER,
                id: userId,
                name: userMetadata?.name,
                email: userMetadata?.email,
                role: userMetadata?.role,
            };
            let sessionId = activeCtx.sessionId;
            if (!sessionId) {
                const session = session_1.sessionManager.createSession(userId, userMetadata);
                activeCtx.sessionId = session.sessionId;
            }
            else {
                const session = session_1.sessionManager.reconstructSession(sessionId);
                session.identify(userId, userMetadata);
            }
        }
    },
    setUser(user) {
        const activeCtx = context_store_1.contextStore.get();
        if (activeCtx) {
            activeCtx.actor = {
                type: constants_1.ActorType.USER,
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
    setOrganization(orgId) {
        const activeCtx = context_store_1.contextStore.get();
        if (activeCtx) {
            activeCtx.tenant.organizationId = orgId;
        }
    },
    setWorkspace(workspaceId) {
        const activeCtx = context_store_1.contextStore.get();
        if (activeCtx) {
            activeCtx.tenant.projectId = workspaceId;
            activeCtx.metadata.workspaceId = workspaceId;
        }
    },
    clearIdentity() {
        const activeCtx = context_store_1.contextStore.get();
        if (activeCtx) {
            delete activeCtx.actor;
            delete activeCtx.sessionId;
        }
    },
    resetIdentity() {
        const activeCtx = context_store_1.contextStore.get();
        if (activeCtx) {
            delete activeCtx.actor;
            const session = session_1.sessionManager.createSession();
            activeCtx.sessionId = session.sessionId;
        }
    },
    currentSession() {
        return session_1.sessionManager.currentSession();
    },
    async trackBusinessEvent(name, metadata) {
        return this.track({
            category: constants_1.EventCategory.BUSINESS,
            type: "business",
            action: name,
            severity: constants_1.Severity.INFO,
            message: `Business Event: ${name}`,
            metadata: metadata || {},
        });
    },
    async trackOnboarding(userId, step, location, metadata) {
        return this.track({
            category: constants_1.EventCategory.ONBOARDING,
            type: "onboarding",
            action: step,
            severity: constants_1.Severity.INFO,
            message: `User Onboarding: user ${userId} at step ${step}`,
            onboarding: {
                userId,
                step,
                location,
                metadata,
            },
        });
    },
    business: {
        async orderCreated(orderId, amount, currency, metadata) {
            return exports.logsense.trackBusinessEvent("order.created", {
                orderId,
                amount,
                currency,
                ...metadata,
            });
        },
        async paymentSucceeded(paymentId, amount, currency, metadata) {
            return exports.logsense.trackBusinessEvent("payment.succeeded", {
                paymentId,
                amount,
                currency,
                ...metadata,
            });
        },
        async userRegistered(userId, email, metadata) {
            return exports.logsense.trackBusinessEvent("user.registered", {
                userId,
                email,
                ...metadata,
            });
        },
        async subscriptionRenewed(subscriptionId, plan, amount, metadata) {
            return exports.logsense.trackBusinessEvent("subscription.renewed", {
                subscriptionId,
                plan,
                amount,
                ...metadata,
            });
        },
    },
    onboarding: {
        async userOnboarded(userId, step, location, metadata) {
            return exports.logsense.trackOnboarding(userId, step, location, metadata);
        },
    },
    metrics() {
        if (globalClient) {
            const queue = globalClient.queue;
            const memoryQueueSize = queue instanceof memory_queue_1.MemoryQueue ? queue.size() : 0;
            const diskQueueSize = queue instanceof disk_queue_1.DiskQueue ? queue.size() : 0;
            return {
                queueSize: queue.size(),
                retries: metrics_1.metricsCollector.getRetryCount(),
                transportFailures: metrics_1.metricsCollector.getTransportFailureCount(),
                droppedEvents: metrics_1.metricsCollector.getEventsDropped(),
                averageBatchSize: metrics_1.metricsCollector.getAverageBatchSize(),
                eventsPerSecond: metrics_1.metricsCollector.getEventsPerSecond(),
                flushCount: metrics_1.metricsCollector.getFlushCount(),
                averageLatency: metrics_1.metricsCollector.getAverageTransportLatency(),
                memoryQueueSize,
                diskQueueSize,
            };
        }
        return null;
    },
    health() {
        if (globalClient) {
            return globalClient.healthMonitor.getHealth();
        }
        return null;
    },
    use(plugin) {
        if (globalClient) {
            globalClient.use(plugin);
        }
    },
};
//# sourceMappingURL=sdk.js.map