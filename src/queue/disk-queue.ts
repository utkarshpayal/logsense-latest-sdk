import * as fs from "node:fs/promises";
import * as path from "node:path";
import { Event } from "../event/types";
import { EventQueue } from "./queue";

export interface DiskQueueOptions {
    queueDir: string;
    maxSize?: number;
}

export class DiskQueue implements EventQueue {
    private readonly queueDir: string;
    private readonly maxSize: number;
    private readonly filesList: string[] = [];
    private readonly eventMap = new Map<string, string>(); // eventId -> filename
    private initialized = false;
    private initPromise: Promise<void> | null = null;

    constructor(options: DiskQueueOptions) {
        this.queueDir = path.resolve(options.queueDir);
        this.maxSize = options.maxSize ?? 5000;
    }

    /**
     * Initializes the queue by reading files from disk.
     */
    async init(): Promise<void> {
        if (this.initialized) {
            return;
        }

        if (!this.initPromise) {
            this.initPromise = (async () => {
                try {
                    await fs.mkdir(this.queueDir, { recursive: true });
                    const files = await fs.readdir(this.queueDir);

                    // Filter for files matching our pattern timestamp-eventId.json
                    const queueFiles = files
                        .filter((f) => f.endsWith(".json") && f.includes("-"))
                        .map((f) => ({
                            filename: f,
                            timestamp: parseInt(f.split("-")[0] || "0", 10),
                        }));

                    // Sort chronologically
                    queueFiles.sort((a, b) => a.timestamp - b.timestamp);

                    for (const item of queueFiles) {
                        const parts = item.filename.slice(0, -5).split("-");
                        // The event ID is the second part
                        const eventId = parts.slice(1).join("-");
                        if (eventId) {
                            this.filesList.push(item.filename);
                            this.eventMap.set(eventId, item.filename);
                        }
                    }

                    this.initialized = true;
                } catch (error) {
                    console.error("[LogSense] Failed to initialize DiskQueue:", error);
                    // Proceed with empty queue
                    this.initialized = true;
                }
            })();
        }

        return this.initPromise;
    }

    async enqueue(event: Event): Promise<void> {
        if (!this.initialized) {
            await this.init();
        }

        if (this.filesList.length >= this.maxSize) {
            throw new Error(`Disk queue limit (${this.maxSize}) exceeded.`);
        }

        const eventId = event.relationships.eventId;
        const filename = `${Date.now()}-${eventId}.json`;
        const filePath = path.join(this.queueDir, filename);

        await fs.writeFile(filePath, JSON.stringify(event), "utf8");

        this.filesList.push(filename);
        this.eventMap.set(eventId, filename);
    }

    async enqueueMany(events: Event[]): Promise<void> {
        await Promise.all(events.map((event) => this.enqueue(event)));
    }

    async peek(limit?: number): Promise<Event[]> {
        if (!this.initialized) {
            await this.init();
        }

        const count = limit === undefined ? this.filesList.length : Math.min(limit, this.filesList.length);
        const peekedEvents: Event[] = [];

        for (let i = 0; i < count; i++) {
            const filename = this.filesList[i];
            if (!filename) {
                continue;
            }
            const filePath = path.join(this.queueDir, filename);
            try {
                const content = await fs.readFile(filePath, "utf8");
                const event = JSON.parse(content) as Event;
                peekedEvents.push(event);
            } catch (error) {
                console.error(`[LogSense] Failed to read disk queue file: ${filename}`, error);
            }
        }

        return peekedEvents;
    }

    async ack(events: Event[]): Promise<void> {
        if (!this.initialized) {
            await this.init();
        }

        for (const event of events) {
            const eventId = event.relationships.eventId;
            const filename = this.eventMap.get(eventId);

            if (filename) {
                const filePath = path.join(this.queueDir, filename);
                try {
                    await fs.unlink(filePath);
                } catch (error: any) {
                    if (error?.code !== "ENOENT") {
                        console.error(`[LogSense] Failed to delete disk queue file: ${filename}`, error);
                    }
                }

                const index = this.filesList.indexOf(filename);
                if (index !== -1) {
                    this.filesList.splice(index, 1);
                }
                this.eventMap.delete(eventId);
            }
        }
    }

    async clear(): Promise<void> {
        if (!this.initialized) {
            await this.init();
        }

        for (const filename of this.filesList) {
            const filePath = path.join(this.queueDir, filename);
            try {
                await fs.unlink(filePath);
            } catch (error: any) {
                if (error?.code !== "ENOENT") {
                    console.error(`[LogSense] Failed to delete disk queue file during clear: ${filename}`, error);
                }
            }
        }

        this.filesList.length = 0;
        this.eventMap.clear();
    }

    size(): number {
        return this.filesList.length;
    }

    isEmpty(): boolean {
        return this.filesList.length === 0;
    }
}
