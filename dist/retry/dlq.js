"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryDeadLetterQueue = void 0;
class MemoryDeadLetterQueue {
    events = [];
    async store(events, reason) {
        const storedAt = new Date().toISOString();
        for (const event of events) {
            this.events.push({ event, reason, storedAt });
        }
    }
    async export() {
        return this.events.map((item) => item.event);
    }
    async clear() {
        this.events.length = 0;
    }
    size() {
        return this.events.length;
    }
    getDetails() {
        return [...this.events];
    }
}
exports.MemoryDeadLetterQueue = MemoryDeadLetterQueue;
//# sourceMappingURL=dlq.js.map