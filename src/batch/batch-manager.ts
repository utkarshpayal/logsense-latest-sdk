import { EventQueue } from "../queue";
import { EventTransport } from "../transport";
import { RetryManager } from "../retry/retry-manager";
import { LogSensePlugin } from "../pipeline/plugin";
import { metricsCollector } from "../monitoring/metrics";

export interface BatchManagerOptions {
    queue: EventQueue;

    transport: EventTransport;

    retryManager?: RetryManager;

    /**
     * Flush after this many events.
     */
    maxBatchSize?: number;

    /**
     * Flush every X milliseconds.
     */
    flushInterval?: number;

    plugins?: LogSensePlugin[];
}

export class BatchManager {
    private readonly queue: EventQueue;

    private readonly transport: EventTransport;

    private readonly retryManager: RetryManager | undefined;

    private readonly maxBatchSize: number;

    private readonly flushInterval: number;

    private readonly plugins: LogSensePlugin[];

    private timer: NodeJS.Timeout | null = null;

    private flushing = false;

    constructor(options: BatchManagerOptions) {
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
    start(): void {
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
    stop(): void {
        if (!this.timer) {
            return;
        }

        clearInterval(this.timer);

        this.timer = null;
    }

    /**
     * Notify after enqueue().
     */
    async notify(): Promise<void> {
        if (this.queue.size() >= this.maxBatchSize) {
            await this.flush();
        }
    }

    /**
     * Flush queued events.
     */
    async flush(): Promise<void> {
        if (this.flushing) {
            return;
        }

        if (this.queue.isEmpty()) {
            return;
        }

        this.flushing = true;

        try {
            const events = await this.queue.peek(this.maxBatchSize);

            if (events.length === 0) {
                return;
            }

            // execute beforeTransport hook
            let currentEvents = [...events];
            for (const plugin of this.plugins) {
                if (plugin.beforeTransport) {
                    try {
                        const res = await plugin.beforeTransport(currentEvents);
                        if (res) currentEvents = res;
                    } catch (err) {
                        if (plugin.onError) {
                            await plugin.onError(err as Error, { stage: "beforeTransport", batch: currentEvents });
                        }
                    }
                }
            }

            const startTime = Date.now();
            const result = await this.transport.sendBatch(currentEvents);
            const latency = Date.now() - startTime;
            metricsCollector.recordTransportLatency(latency);
            metricsCollector.recordFlush(currentEvents.length);

            // execute afterTransport hook
            for (const plugin of this.plugins) {
                if (plugin.afterTransport) {
                    try {
                        await plugin.afterTransport(currentEvents, result);
                    } catch (err) {
                        if (plugin.onError) {
                            await plugin.onError(err as Error, { stage: "afterTransport", batch: currentEvents, result });
                        }
                    }
                }
            }

            if (result.success) {
                metricsCollector.recordTransportSuccess();
                await this.queue.ack(events);
            } else {
                metricsCollector.recordTransportFailure();
                for (const plugin of this.plugins) {
                    if (plugin.onError) {
                        await plugin.onError(result.error || new Error("Transport failed"), { stage: "transport", batch: currentEvents, result });
                    }
                }
                if (this.retryManager) {
                    await this.queue.ack(events);
                    await this.retryManager.schedule(events, result.statusCode, result.error);
                } else {
                    console.error(
                        "[LogSense] Failed to send event batch. Events remain in queue.",
                        result.error,
                    );
                }
            }
        } finally {
            this.flushing = false;
        }
    }

    /**
     * Flush and stop.
     */
    async shutdown(): Promise<void> {
        this.stop();

        await this.flush();

        await this.transport.close?.();

        // execute onShutdown hook
        for (const plugin of this.plugins) {
            if (plugin.onShutdown) {
                try {
                    await plugin.onShutdown();
                } catch (err) {
                    if (plugin.onError) {
                        await plugin.onError(err as Error, { stage: "onShutdown" });
                    }
                }
            }
        }
    }
}