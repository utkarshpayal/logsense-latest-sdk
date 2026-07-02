import { EventQueue } from "../queue/queue";
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
export declare class HealthMonitor {
    private readonly queue;
    private readonly retryManager;
    private readonly metrics;
    private readonly maxQueueThreshold;
    constructor(options: HealthMonitorOptions);
    /**
     * Expose health API.
     */
    getHealth(): HealthStatus;
}
//# sourceMappingURL=health.d.ts.map