import { Event } from "../event/types";
import { EventProcessor } from "./processor";
export declare class EventPipeline {
    private readonly processors;
    /**
     * Register processor.
     */
    use(processor: EventProcessor): this;
    /**
     * Remove every processor.
     */
    clear(): void;
    /**
     * Number of processors.
     */
    size(): number;
    /**
     * Execute pipeline.
     */
    execute(event: Event): Promise<Event | null>;
}
//# sourceMappingURL=pipeline.d.ts.map