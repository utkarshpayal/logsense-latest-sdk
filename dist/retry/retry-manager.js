"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RetryManager = void 0;
const metrics_1 = require("../monitoring/metrics");
class RetryManager {
    transport;
    backoffStrategy;
    dlq;
    maxAttempts;
    debug;
    plugins;
    pendingTimers = new Set();
    pendingEvents = new Map();
    retryCount = 0;
    activeRetryAttempts = 0;
    retryQueueSize = 0;
    shutDown = false;
    constructor(options) {
        this.transport = options.transport;
        this.backoffStrategy = options.backoffStrategy;
        this.dlq = options.dlq;
        this.maxAttempts = options.maxAttempts ?? 5;
        this.debug = options.debug ?? false;
        this.plugins = options.plugins ?? [];
    }
    isShutDown() {
        return this.shutDown;
    }
    /**
     * Determine if an HTTP status code or error is retryable.
     */
    isRetryable(statusCode, error) {
        // Network/connection errors (no status code) are retryable
        if (statusCode === undefined || statusCode === 0) {
            return true;
        }
        // Retryable HTTP status codes
        const retryableCodes = [429, 500, 503];
        if (retryableCodes.includes(statusCode)) {
            return true;
        }
        // Do not retry 400, 401, 403, 404
        return false;
    }
    /**
     * Schedule a batch of events for retry.
     */
    async schedule(events, statusCode, error) {
        if (this.shutDown || events.length === 0) {
            return;
        }
        const reason = error?.message || `HTTP Status ${statusCode || "unknown"}`;
        if (!this.isRetryable(statusCode, error)) {
            if (this.debug) {
                console.warn(`[LogSense] Non-retryable error (${reason}). Moving ${events.length} events to DLQ.`);
            }
            await this.dlq.store(events, `Non-retryable error: ${reason}`);
            return;
        }
        // Start retry loop with attempt = 1
        this.retryQueueSize += events.length;
        await this.retry(events, 1, reason);
    }
    /**
     * Get the number of events currently waiting for retry.
     */
    getRetryQueueSize() {
        return this.retryQueueSize;
    }
    /**
     * Get the total number of retry attempts made.
     */
    getRetryCount() {
        return this.retryCount;
    }
    /**
     * Internal recursive retry function.
     */
    async retry(events, attempt, reason) {
        if (attempt > this.maxAttempts) {
            if (this.debug) {
                console.warn(`[LogSense] Max retry attempts (${this.maxAttempts}) exceeded. Moving ${events.length} events to DLQ.`);
            }
            this.retryQueueSize -= events.length;
            await this.dlq.store(events, `Max attempts exceeded. Original reason: ${reason}`);
            return;
        }
        const delay = this.backoffStrategy.getDelay(attempt);
        if (this.debug) {
            console.log(`[LogSense] Scheduling retry attempt ${attempt}/${this.maxAttempts} for ${events.length} events in ${delay}ms. Reason: ${reason}`);
        }
        // Trigger onRetry hooks
        for (const plugin of this.plugins) {
            if (plugin.onRetry) {
                try {
                    await plugin.onRetry(events, attempt, delay);
                }
                catch (err) {
                    if (plugin.onError) {
                        await plugin.onError(err, { stage: "onRetry", batch: events, attempt, delay });
                    }
                }
            }
        }
        this.activeRetryAttempts++;
        const timer = setTimeout(async () => {
            this.pendingTimers.delete(timer);
            this.pendingEvents.delete(timer);
            this.retryCount++;
            metrics_1.metricsCollector.recordRetry();
            try {
                const startTime = Date.now();
                const result = await this.transport.sendBatch(events);
                const latency = Date.now() - startTime;
                metrics_1.metricsCollector.recordTransportLatency(latency);
                if (result.success) {
                    metrics_1.metricsCollector.recordTransportSuccess();
                    if (this.debug) {
                        console.log(`[LogSense] Retry attempt ${attempt} succeeded for ${events.length} events.`);
                    }
                    this.retryQueueSize -= events.length;
                }
                else {
                    metrics_1.metricsCollector.recordTransportFailure();
                    const newReason = result.error?.message || `HTTP Status ${result.statusCode || "unknown"}`;
                    // Trigger onError hook for unsuccessful retry
                    for (const plugin of this.plugins) {
                        if (plugin.onError) {
                            await plugin.onError(result.error || new Error(newReason), { stage: "retryAttemptFailed", batch: events, attempt, result });
                        }
                    }
                    if (this.isRetryable(result.statusCode, result.error)) {
                        await this.retry(events, attempt + 1, newReason);
                    }
                    else {
                        if (this.debug) {
                            console.warn(`[LogSense] Retry attempt ${attempt} failed with non-retryable error (${newReason}). Moving ${events.length} events to DLQ.`);
                        }
                        this.retryQueueSize -= events.length;
                        await this.dlq.store(events, `Retry failed with non-retryable error: ${newReason}`);
                    }
                }
            }
            catch (err) {
                const failError = err instanceof Error ? err : new Error(String(err));
                for (const plugin of this.plugins) {
                    if (plugin.onError) {
                        await plugin.onError(failError, { stage: "retryExecutionError", batch: events, attempt });
                    }
                }
                await this.retry(events, attempt + 1, failError.message);
            }
            finally {
                this.activeRetryAttempts--;
            }
        }, delay);
        this.pendingTimers.add(timer);
        this.pendingEvents.set(timer, events);
    }
    /**
     * Gracefully shutdown the retry manager: cancels all timers.
     * Any scheduled events that were not sent are stored in the DLQ.
     */
    async shutdown() {
        this.shutDown = true;
        if (this.debug && this.pendingTimers.size > 0) {
            console.log(`[LogSense] Shutting down RetryManager. Cancelling ${this.pendingTimers.size} pending timers.`);
        }
        const abortedEvents = [];
        for (const [timer, events] of this.pendingEvents.entries()) {
            clearTimeout(timer);
            abortedEvents.push(...events);
        }
        this.pendingEvents.clear();
        this.pendingTimers.clear();
        this.activeRetryAttempts = 0;
        this.retryQueueSize = 0;
        return abortedEvents;
    }
}
exports.RetryManager = RetryManager;
//# sourceMappingURL=retry-manager.js.map