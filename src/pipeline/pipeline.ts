import { Event } from "../event/types";
import { EventProcessor } from "./processor";

export class EventPipeline {
    private readonly processors: EventProcessor[] = [];

    /**
     * Register processor.
     */
    use(processor: EventProcessor): this {
        this.processors.push(processor);
        return this;
    }

    /**
     * Remove every processor.
     */
    clear(): void {
        this.processors.length = 0;
    }

    /**
     * Number of processors.
     */
    size(): number {
        return this.processors.length;
    }

    /**
     * Execute pipeline.
     */
    async execute(
        event: Event,
    ): Promise<Event | null> {
        let current: Event | null = event;

        for (const processor of this.processors) {
            if (!current) {
                return null;
            }

            current = await processor.process(current);
        }

        return current;
    }
}