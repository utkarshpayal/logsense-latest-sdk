import { Event } from "../event/types";
import { EventQueue } from "./queue";

export interface MemoryQueueOptions {
    /**
     * Maximum number of events allowed in memory.
     */
    maxSize?: number;
}

export class MemoryQueue implements EventQueue {
    private readonly events: Event[] = [];

    private readonly maxSize: number;

    constructor(options: MemoryQueueOptions = {}) {
        this.maxSize = options.maxSize ?? 5000;
    }

    /**
     * Add an event to the queue.
     */
    async enqueue(event: Event): Promise<void> {
        if (this.events.length >= this.maxSize) {
            throw new Error(
                `Memory queue limit (${this.maxSize}) exceeded.`,
            );
        }

        this.events.push(event);
    }

    /**
     * Add multiple events to the queue.
     */
    async enqueueMany(events: Event[]): Promise<void> {
        for (const event of events) {
            await this.enqueue(event);
        }
    }
    /**
     * Peek events without removing them.
     */
    async peek(limit?: number): Promise<Event[]> {
        if (limit === undefined) {
            return [...this.events];
        }
        return this.events.slice(0, limit);
    }

    /**
     * Remove only acknowledged events.
     */
    async ack(events: Event[]): Promise<void> {
        const toRemove = new Set(events);
        let writeIndex = 0;
        for (let readIndex = 0; readIndex < this.events.length; readIndex++) {
            const event = this.events[readIndex];
            if (event !== undefined && !toRemove.has(event)) {
                this.events[writeIndex] = event;
                writeIndex++;
            }
        }
        this.events.length = writeIndex;
    }

    /**
     * Number of queued events.
     */
    size(): number {
        return this.events.length;
    }

    /**
     * Is queue empty?
     */
    isEmpty(): boolean {
        return this.events.length === 0;
    }

    /**
     * Clear queue.
     */
    clear(): void {
        this.events.length = 0;
    }
}