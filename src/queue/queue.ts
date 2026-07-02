import { Event } from "../event/types";

export interface EventQueue {
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
     * Acknowledge/remove processed events.
     */
    ack(events: Event[]): Promise<void>;

    /**
     * Remove everything.
     */
    clear(): void | Promise<void>;

    /**
     * Current queue size.
     */
    size(): number;

    /**
     * Returns true if queue has no events.
     */
    isEmpty(): boolean;
}