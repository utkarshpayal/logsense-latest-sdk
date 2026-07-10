"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BatchManager = void 0;
const metrics_1 = require("../monitoring/metrics");
class BatchManager {
    queue;
    transport;
    retryManager;
    maxBatchSize;
    flushInterval;
    plugins;
    timer = null;
    flushing = false;
    currentFlushPromise = null;
    shouldFlushAgain = false;
    constructor(options) {
        this.queue = options.queue;
        this.transport = options.transport;
        this.retryManager = options.retryManager;
        this.maxBatchSize = options.maxBatchSize ?? 100;
        this.flushInterval = options.flushInterval ?? 5000;
        this.plugins = options.plugins ?? [];
    }
    /**
     * Start automatic flushing.
     */
    start() {
        if (this.timer) {
            return;
        }
        this.timer = setInterval(() => {
            void this.flush();
        }, this.flushInterval);
    }
    /**
     * Stop automatic flushing.
     */
    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }
    /**
     * Notify after enqueue().
     */
    async notify() {
        if (this.queue.size() >= this.maxBatchSize) {
            await this.flush();
        }
    }
    /**
     * Flush queued events.
     */
    async flush() {
        if (this.flushing) {
            this.shouldFlushAgain = true;
            if (this.currentFlushPromise) {
                await this.currentFlushPromise;
            }
            return;
        }
        if (this.queue.isEmpty()) {
            return;
        }
        this.flushing = true;
        this.shouldFlushAgain = false;
        this.currentFlushPromise = (async () => {
            try {
                // Loop to drain the queue in batches instead of recursively calling flush()
                while (!this.queue.isEmpty()) {
                    const events = await this.queue.peek(this.maxBatchSize);
                    if (events.length === 0) {
                        break;
                    }
                    // execute beforeTransport hook
                    let currentEvents = [...events];
                    for (const plugin of this.plugins) {
                        if (plugin.beforeTransport) {
                            try {
                                const res = await plugin.beforeTransport(currentEvents);
                                if (res)
                                    currentEvents = res;
                            }
                            catch (err) {
                                if (plugin.onError) {
                                    await plugin.onError(err, { stage: "beforeTransport", batch: currentEvents });
                                }
                            }
                        }
                    }
                    const startTime = Date.now();
                    const result = await this.transport.sendBatch(currentEvents);
                    const latency = Date.now() - startTime;
                    metrics_1.metricsCollector.recordTransportLatency(latency);
                    metrics_1.metricsCollector.recordFlush(currentEvents.length);
                    // execute afterTransport hook
                    for (const plugin of this.plugins) {
                        if (plugin.afterTransport) {
                            try {
                                await plugin.afterTransport(currentEvents, result);
                            }
                            catch (err) {
                                if (plugin.onError) {
                                    await plugin.onError(err, { stage: "afterTransport", batch: currentEvents, result });
                                }
                            }
                        }
                    }
                    if (result.success) {
                        metrics_1.metricsCollector.recordTransportSuccess();
                        await this.queue.ack(events);
                    }
                    else {
                        metrics_1.metricsCollector.recordTransportFailure();
                        for (const plugin of this.plugins) {
                            if (plugin.onError) {
                                await plugin.onError(result.error || new Error("Transport failed"), { stage: "transport", batch: currentEvents, result });
                            }
                        }
                        if (this.retryManager && !this.retryManager.isShutDown()) {
                            await this.queue.ack(events);
                            await this.retryManager.schedule(events, result.statusCode, result.error);
                        }
                        else {
                            console.error("[LogSense] Failed to send event batch. Events remain in queue.", result.error);
                            // Break the loop on failure to prevent infinite retry loops
                            break;
                        }
                    }
                }
            }
            catch (err) {
                console.error("[LogSense] Error during batch flush:", err);
            }
            finally {
                this.flushing = false;
                this.currentFlushPromise = null;
                // If a flush request came in while we were flushing, trigger one more check
                if (this.shouldFlushAgain && !this.queue.isEmpty()) {
                    this.shouldFlushAgain = false;
                    void this.flush();
                }
            }
        })();
        return this.currentFlushPromise;
    }
    /**
     * Flush and stop.
     */
    async shutdown() {
        this.stop();
        await this.flush();
        await this.transport.close?.();
        // execute onShutdown hook
        for (const plugin of this.plugins) {
            if (plugin.onShutdown) {
                try {
                    await plugin.onShutdown();
                }
                catch (err) {
                    if (plugin.onError) {
                        await plugin.onError(err, { stage: "onShutdown" });
                    }
                }
            }
        }
    }
}
exports.BatchManager = BatchManager;
//# sourceMappingURL=batch-manager.js.map