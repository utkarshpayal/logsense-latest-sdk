import { EventQueue } from "../queue";
import { EventTransport } from "../transport";
import { RetryManager } from "../retry/retry-manager";
import { LogSensePlugin } from "../pipeline/plugin";
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
export declare class BatchManager {
    private readonly queue;
    private readonly transport;
    private readonly retryManager;
    private readonly maxBatchSize;
    private readonly flushInterval;
    private readonly plugins;
    private timer;
    private flushing;
    constructor(options: BatchManagerOptions);
    /**
     * Start automatic flushing.
     */
    start(): void;
    /**
     * Stop automatic flushing.
     */
    stop(): void;
    /**
     * Notify after enqueue().
     */
    notify(): Promise<void>;
    /**
     * Flush queued events.
     */
    flush(): Promise<void>;
    /**
     * Flush and stop.
     */
    shutdown(): Promise<void>;
}
//# sourceMappingURL=batch-manager.d.ts.map