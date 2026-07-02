"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthMonitor = void 0;
const memory_queue_1 = require("../queue/memory-queue");
const disk_queue_1 = require("../queue/disk-queue");
class HealthMonitor {
    queue;
    retryManager;
    metrics;
    maxQueueThreshold;
    constructor(options) {
        this.queue = options.queue;
        this.retryManager = options.retryManager;
        this.metrics = options.metrics;
        this.maxQueueThreshold = options.maxQueueThreshold ?? 4000;
    }
    /**
     * Expose health API.
     */
    getHealth() {
        const queueSize = this.queue.size();
        const retryQueueSize = this.retryManager.getRetryQueueSize();
        const memoryQueueSize = this.queue instanceof memory_queue_1.MemoryQueue ? this.queue.size() : 0;
        const diskQueueSize = this.queue instanceof disk_queue_1.DiskQueue ? this.queue.size() : 0;
        const successCount = this.metrics.getTransportSuccessCount();
        const failureCount = this.metrics.getTransportFailureCount();
        const totalAttempts = successCount + failureCount;
        const successRate = totalAttempts > 0 ? successCount / totalAttempts : 1.0;
        // Retrieve last successful upload
        // (we cast metrics to any to access the property added in previous step or read from successCount timestamp)
        const lastSuccessfulUpload = this.metrics.lastSuccessfulUploadTime || null;
        // Determine health status based on thresholds
        let status = "healthy";
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
exports.HealthMonitor = HealthMonitor;
//# sourceMappingURL=health.js.map