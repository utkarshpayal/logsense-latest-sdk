import { Event } from "../event/types";

export interface DeadLetterQueue {
    store(events: Event[], reason: string): Promise<void>;
    export(): Promise<Event[]>;
    clear(): Promise<void>;
    size(): number;
}

export class MemoryDeadLetterQueue implements DeadLetterQueue {
    private readonly events: { event: Event; reason: string; storedAt: string }[] = [];

    async store(events: Event[], reason: string): Promise<void> {
        const storedAt = new Date().toISOString();
        for (const event of events) {
            this.events.push({ event, reason, storedAt });
        }
    }

    async export(): Promise<Event[]> {
        return this.events.map((item) => item.event);
    }

    async clear(): Promise<void> {
        this.events.length = 0;
    }

    size(): number {
        return this.events.length;
    }

    getDetails(): { event: Event; reason: string; storedAt: string }[] {
        return [...this.events];
    }
}
