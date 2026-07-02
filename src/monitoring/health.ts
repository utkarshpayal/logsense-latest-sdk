import { EventQueue } from "../queue/queue";
import { MemoryQueue } from "../queue/memory-queue";
import { DiskQueue } from "../queue/disk-queue";
import { RetryManager } from "../retry/retry-manager";
import { MetricsCollector } from "./metrics";

export interface HealthStatus {
    status: "healthy" | "unhealthy";
    transport: {
        successCount: number;
        failureCount: number;
        successRate: number;
        lastSuccessfulUpload: number | null;
        avgLatencyMs: number;
    };
    queue: {
        totalSize: number;
        memoryQueueSize: number;
        diskQueueSize: number;
        pendingUploads: number;
    };
    retry: {
        retryQueueSize: number;
        totalRetries: number;
    };
    runtime: {
        memory: NodeJS.MemoryUsage;
        cpu: NodeJS.CpuUsage;
        uptimeSeconds: number;
    };
}

export interface HealthMonitorOptions {
    queue: EventQueue;
    retryManager: RetryManager;
    metrics: MetricsCollector;
    maxQueueThreshold?: number;
}

export class HealthMonitor {
    private readonly queue: EventQueue;
    private readonly retryManager: RetryManager;
    private readonly metrics: MetricsCollector;
    private readonly maxQueueThreshold: number;

    constructor(options: HealthMonitorOptions) {
        this.queue = options.queue;
        this.retryManager = options.retryManager;
        this.metrics = options.metrics;
        this.maxQueueThreshold = options.maxQueueThreshold ?? 4000;
    }

    /**
     * Expose health API.
     */
    getHealth(): HealthStatus {
        const queueSize = this.queue.size();
        const retryQueueSize = this.retryManager.getRetryQueueSize();
        const memoryQueueSize = this.queue instanceof MemoryQueue ? this.queue.size() : 0;
        const diskQueueSize = this.queue instanceof DiskQueue ? this.queue.size() : 0;

        const successCount = this.metrics.getTransportSuccessCount();
        const failureCount = this.metrics.getTransportFailureCount();
        const totalAttempts = successCount + failureCount;
        const successRate = totalAttempts > 0 ? successCount / totalAttempts : 1.0;

        // Retrieve last successful upload
        // (we cast metrics to any to access the property added in previous step or read from successCount timestamp)
        const lastSuccessfulUpload = (this.metrics as any).lastSuccessfulUploadTime || null;

        // Determine health status based on thresholds
        let status: "healthy" | "unhealthy" = "healthy";
        if (queueSize >= this.maxQueueThreshold || (totalAttempts >= 5 && successRate < 0.2)) {
            status = "unhealthy";
        }

        return {
            status,
            transport: {
                successCount,
                failureCount,
                successRate,
                lastSuccessfulUpload,
                avgLatencyMs: this.metrics.getAverageTransportLatency(),
            },
            queue: {
                totalSize: queueSize,
                memoryQueueSize,
                diskQueueSize,
                pendingUploads: queueSize + retryQueueSize,
            },
            retry: {
                retryQueueSize,
                totalRetries: this.metrics.getRetryCount(),
            },
            runtime: {
                memory: process.memoryUsage(),
                cpu: process.cpuUsage(),
                uptimeSeconds: process.uptime(),
            },
        };
    }
}
