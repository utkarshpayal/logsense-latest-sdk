import { Event } from "../event/types";
import { EventQueue } from "./queue";
export interface DiskQueueOptions {
    queueDir: string;
    maxSize?: number;
}
export declare class DiskQueue implements EventQueue {
    private readonly queueDir;
    private readonly maxSize;
    private readonly filesList;
    private readonly eventMap;
    private initialized;
    private initPromise;
    constructor(options: DiskQueueOptions);
    /**
     * Initializes the queue by reading files from disk.
     */
    init(): Promise<void>;
    enqueue(event: Event): Promise<void>;
    enqueueMany(events: Event[]): Promise<void>;
    peek(limit?: number): Promise<Event[]>;
    ack(events: Event[]): Promise<void>;
    clear(): Promise<void>;
    size(): number;
    isEmpty(): boolean;
}
//# sourceMappingURL=disk-queue.d.ts.map