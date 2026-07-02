"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Collector = void 0;
const pipeline_1 = require("../pipeline/pipeline");
const metrics_1 = require("../monitoring/metrics");
class Collector {
    builder;
    queue;
    batchManager;
    pipeline;
    plugins = [];
    constructor(options) {
        this.builder = options.builder;
        this.queue = options.queue;
        this.batchManager = options.batchManager;
        this.plugins = options.plugins ?? [];
        this.pipeline =
            options.pipeline ?? new pipeline_1.EventPipeline();
    }
    /**
     * Register a lifecycle plugin or processor.
     */
    use(processor) {
        if ("process" in processor) {
            this.pipeline.use(processor);
        }
        else {
            this.plugins.push(processor);
        }
        return this;
    }
    /**
     * Collect an event.
     */
    async collect(partial) {
        // ----------------------------------------------------
        // execute beforeBuild hook
        // ----------------------------------------------------
        let currentPartial = partial;
        for (const plugin of this.plugins) {
            if (plugin.beforeBuild) {
                try {
                    const res = await plugin.beforeBuild(currentPartial);
                    if (res === null) {
                        metrics_1.metricsCollector.recordEventDropped();
                        return null;
                    }
                    if (res)
                        currentPartial = res;
                }
                catch (err) {
                    if (plugin.onError) {
                        await plugin.onError(err, { stage: "beforeBuild", partial });
                    }
                }
            }
        }
        // ----------------------------------------------------
        // Build complete event
        // ----------------------------------------------------
        let event = this.builder.build(currentPartial);
        // ----------------------------------------------------
        // execute afterBuild hook
        // ----------------------------------------------------
        for (const plugin of this.plugins) {
            if (plugin.afterBuild) {
                try {
                    const res = await plugin.afterBuild(event);
                    if (res === null) {
                        metrics_1.metricsCollector.recordEventDropped();
                        return null;
                    }
                    if (res)
                        event = res;
                }
                catch (err) {
                    if (plugin.onError) {
                        await plugin.onError(err, { stage: "afterBuild", event });
                    }
                }
            }
        }
        // ----------------------------------------------------
        // Execute pipeline
        // ----------------------------------------------------
        const processed = await this.pipeline.execute(event);
        // Event dropped
        if (!processed) {
            metrics_1.metricsCollector.recordEventDropped();
            return null;
        }
        event = processed;
        // ----------------------------------------------------
        // execute beforeQueue hook
        // ----------------------------------------------------
        for (const plugin of this.plugins) {
            if (plugin.beforeQueue) {
                try {
                    const res = await plugin.beforeQueue(event);
                    if (res === null) {
                        metrics_1.metricsCollector.recordEventDropped();
                        return null;
                    }
                    if (res)
                        event = res;
                }
                catch (err) {
                    if (plugin.onError) {
                        await plugin.onError(err, { stage: "beforeQueue", event });
                    }
                }
            }
        }
        // ----------------------------------------------------
        // Queue event
        // ----------------------------------------------------
        await this.queue.enqueue(event);
        // ----------------------------------------------------
        // execute afterQueue hook
        // ----------------------------------------------------
        for (const plugin of this.plugins) {
            if (plugin.afterQueue) {
                try {
                    await plugin.afterQueue(event);
                }
                catch (err) {
                    if (plugin.onError) {
                        await plugin.onError(err, { stage: "afterQueue", event });
                    }
                }
            }
        }
        // ----------------------------------------------------
        // Notify batch manager
        // ----------------------------------------------------
        await this.batchManager.notify();
        return event;
    }
    /**
     * Force flush.
     */
    async flush() {
        await this.batchManager.flush();
    }
    /**
     * Queue Size.
     */
    queueSize() {
        return this.queue.size();
    }
    /**
     * Is queue empty?
     */
    isEmpty() {
        return this.queue.isEmpty();
    }
    /**
     * Register multiple processors.
     */
    useMany(processors) {
        for (const processor of processors) {
            this.pipeline.use(processor);
        }
        return this;
    }
    /**
     * Clear pipeline.
     */
    clearPipeline() {
        this.pipeline.clear();
    }
    /**
     * Pipeline size.
     */
    pipelineSize() {
        return this.pipeline.size();
    }
}
exports.Collector = Collector;
//# sourceMappingURL=collector.js.map