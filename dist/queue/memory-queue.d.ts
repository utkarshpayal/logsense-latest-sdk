import { Event } from "../event/types";
import { EventQueue } from "./queue";
export interface MemoryQueueOptions {
    /**
     * Maximum number of events allowed in memory.
     */
    maxSize?: number;
}
export declare class MemoryQueue implements EventQueue {
    private readonly events;
    private readonly maxSize;
    constructor(options?: MemoryQueueOptions);
    /**
     * Add an event to the queue.
     */
    enqueue(event: Event): Promise<void>;
    /**
     * Add multiple events to the queue.
     */
    enqueueMany(events: Event[]): Promise<void>;
    /**
     * Peek events without removing them.
     */
    peek(limit?: number): Promise<Event[]>;
    /**
     * Remove only acknowledged events.
     */
    ack(events: Event[]): Promise<void>;
    /**
     * Number of queued events.
     */
    size(): number;
    /**
     * Is queue empty?
     */
    isEmpty(): boolean;
    /**
     * Clear queue.
     */
    clear(): void;
}
//# sourceMappingURL=memory-queue.d.ts.map