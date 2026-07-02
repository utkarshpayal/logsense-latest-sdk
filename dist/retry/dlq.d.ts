import { Event } from "../event/types";
export interface DeadLetterQueue {
    store(events: Event[], reason: string): Promise<void>;
    export(): Promise<Event[]>;
    clear(): Promise<void>;
    size(): number;
}
export declare class MemoryDeadLetterQueue implements DeadLetterQueue {
    private readonly events;
    store(events: Event[], reason: string): Promise<void>;
    export(): Promise<Event[]>;
    clear(): Promise<void>;
    size(): number;
    getDetails(): {
        event: Event;
        reason: string;
        storedAt: string;
    }[];
}
//# sourceMappingURL=dlq.d.ts.map