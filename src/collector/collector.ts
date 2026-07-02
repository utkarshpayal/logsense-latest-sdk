import { BatchManager } from "../batch";
import { EventBuilder } from "../event/builder";
import { Event, PartialEvent } from "../event/types";
import { EventPipeline } from "../pipeline/pipeline";
import { EventProcessor } from "../pipeline/processor";
import { EventQueue } from "../queue";
import { LogSensePlugin } from "../pipeline/plugin";
import { metricsCollector } from "../monitoring/metrics";

export interface CollectorOptions {
    builder: EventBuilder;

    queue: EventQueue;

    batchManager: BatchManager;

    pipeline?: EventPipeline;

    plugins?: LogSensePlugin[];
}

export class Collector {
    private readonly builder: EventBuilder;

    private readonly queue: EventQueue;

    private readonly batchManager: BatchManager;

    private readonly pipeline: EventPipeline;

    private readonly plugins: LogSensePlugin[] = [];

    constructor(options: CollectorOptions) {
        this.builder = options.builder;
        this.queue = options.queue;
        this.batchManager = options.batchManager;
        this.plugins = options.plugins ?? [];

        this.pipeline =
            options.pipeline ?? new EventPipeline();
    }

    /**
     * Register a lifecycle plugin or processor.
     */
    use(processor: EventProcessor | LogSensePlugin): this {
        if ("process" in processor) {
            this.pipeline.use(processor);
        } else {
            this.plugins.push(processor);
        }

        return this;
    }

    /**
     * Collect an event.
     */
    async collect<T extends Event>(
        partial: PartialEvent<T>,
    ): Promise<T | null> {
        // ----------------------------------------------------
        // execute beforeBuild hook
        // ----------------------------------------------------
        let currentPartial = partial;
        for (const plugin of this.plugins) {
            if (plugin.beforeBuild) {
                try {
                    const res = await plugin.beforeBuild(currentPartial);
                    if (res === null) {
                        metricsCollector.recordEventDropped();
                        return null;
                    }
                    if (res) currentPartial = res;
                } catch (err) {
                    if (plugin.onError) {
                        await plugin.onError(err as Error, { stage: "beforeBuild", partial });
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
                        metricsCollector.recordEventDropped();
                        return null;
                    }
                    if (res) event = res as T;
                } catch (err) {
                    if (plugin.onError) {
                        await plugin.onError(err as Error, { stage: "afterBuild", event });
                    }
                }
            }
        }

        // ----------------------------------------------------
        // Execute pipeline
        // ----------------------------------------------------
        const processed =
            await this.pipeline.execute(event);

        // Event dropped
        if (!processed) {
            metricsCollector.recordEventDropped();
            return null;
        }

        event = processed as T;

        // ----------------------------------------------------
        // execute beforeQueue hook
        // ----------------------------------------------------
        for (const plugin of this.plugins) {
            if (plugin.beforeQueue) {
                try {
                    const res = await plugin.beforeQueue(event);
                    if (res === null) {
                        metricsCollector.recordEventDropped();
                        return null;
                    }
                    if (res) event = res as T;
                } catch (err) {
                    if (plugin.onError) {
                        await plugin.onError(err as Error, { stage: "beforeQueue", event });
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
                } catch (err) {
                    if (plugin.onError) {
                        await plugin.onError(err as Error, { stage: "afterQueue", event });
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
    async flush(): Promise<void> {
        await this.batchManager.flush();
    }

    /**
     * Queue Size.
     */
    queueSize(): number {
        return this.queue.size();
    }

    /**
     * Is queue empty?
     */
    isEmpty(): boolean {
        return this.queue.isEmpty();
    }

    /**
     * Register multiple processors.
     */
    useMany(
        processors: EventProcessor[],
    ): this {
        for (const processor of processors) {
            this.pipeline.use(processor);
        }

        return this;
    }

    /**
     * Clear pipeline.
     */
    clearPipeline(): void {
        this.pipeline.clear();
    }

    /**
     * Pipeline size.
     */
    pipelineSize(): number {
        return this.pipeline.size();
    }
}