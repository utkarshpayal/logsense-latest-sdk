import { BatchManager } from "../batch";
import { EventBuilder } from "../event/builder";
import { Event, PartialEvent } from "../event/types";
import { EventPipeline } from "../pipeline/pipeline";
import { EventProcessor } from "../pipeline/processor";
import { EventQueue } from "../queue";
import { LogSensePlugin } from "../pipeline/plugin";
export interface CollectorOptions {
    builder: EventBuilder;
    queue: EventQueue;
    batchManager: BatchManager;
    pipeline?: EventPipeline;
    plugins?: LogSensePlugin[];
}
export declare class Collector {
    private readonly builder;
    private readonly queue;
    private readonly batchManager;
    private readonly pipeline;
    private readonly plugins;
    constructor(options: CollectorOptions);
    /**
     * Register a lifecycle plugin or processor.
     */
    use(processor: EventProcessor | LogSensePlugin): this;
    /**
     * Collect an event.
     */
    collect<T extends Event>(partial: PartialEvent<T>): Promise<T | null>;
    /**
     * Force flush.
     */
    flush(): Promise<void>;
    /**
     * Queue Size.
     */
    queueSize(): number;
    /**
     * Is queue empty?
     */
    isEmpty(): boolean;
    /**
     * Register multiple processors.
     */
    useMany(processors: EventProcessor[]): this;
    /**
     * Clear pipeline.
     */
    clearPipeline(): void;
    /**
     * Pipeline size.
     */
    pipelineSize(): number;
}
//# sourceMappingURL=collector.d.ts.map