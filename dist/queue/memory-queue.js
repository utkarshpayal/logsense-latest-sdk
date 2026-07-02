"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryQueue = void 0;
class MemoryQueue {
    events = [];
    maxSize;
    constructor(options = {}) {
        this.maxSize = options.maxSize ?? 5000;
    }
    /**
     * Add an event to the queue.
     */
    async enqueue(event) {
        if (this.events.length >= this.maxSize) {
            throw new Error(`Memory queue limit (${this.maxSize}) exceeded.`);
        }
        this.events.push(event);
    }
    /**
     * Add multiple events to the queue.
     */
    async enqueueMany(events) {
        for (const event of events) {
            await this.enqueue(event);
        }
    }
    /**
     * Peek events without removing them.
     */
    async peek(limit) {
        if (limit === undefined) {
            return [...this.events];
        }
        return this.events.slice(0, limit);
    }
    /**
     * Remove only acknowledged events.
     */
    async ack(events) {
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
    size() {
        return this.events.length;
    }
    /**
     * Is queue empty?
     */
    isEmpty() {
        return this.events.length === 0;
    }
    /**
     * Clear queue.
     */
    clear() {
        this.events.length = 0;
    }
}
exports.MemoryQueue = MemoryQueue;
//# sourceMappingURL=memory-queue.js.map