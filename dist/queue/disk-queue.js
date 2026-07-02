"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiskQueue = void 0;
const fs = __importStar(require("node:fs/promises"));
const path = __importStar(require("node:path"));
class DiskQueue {
    queueDir;
    maxSize;
    filesList = [];
    eventMap = new Map(); // eventId -> filename
    initialized = false;
    initPromise = null;
    constructor(options) {
        this.queueDir = path.resolve(options.queueDir);
        this.maxSize = options.maxSize ?? 5000;
    }
    /**
     * Initializes the queue by reading files from disk.
     */
    async init() {
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
                }
                catch (error) {
                    console.error("[LogSense] Failed to initialize DiskQueue:", error);
                    // Proceed with empty queue
                    this.initialized = true;
                }
            })();
        }
        return this.initPromise;
    }
    async enqueue(event) {
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
    async enqueueMany(events) {
        for (const event of events) {
            await this.enqueue(event);
        }
    }
    async peek(limit) {
        if (!this.initialized) {
            await this.init();
        }
        const count = limit === undefined ? this.filesList.length : Math.min(limit, this.filesList.length);
        const peekedEvents = [];
        for (let i = 0; i < count; i++) {
            const filename = this.filesList[i];
            if (!filename) {
                continue;
            }
            const filePath = path.join(this.queueDir, filename);
            try {
                const content = await fs.readFile(filePath, "utf8");
                const event = JSON.parse(content);
                peekedEvents.push(event);
            }
            catch (error) {
                console.error(`[LogSense] Failed to read disk queue file: ${filename}`, error);
            }
        }
        return peekedEvents;
    }
    async ack(events) {
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
                }
                catch (error) {
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
    async clear() {
        if (!this.initialized) {
            await this.init();
        }
        for (const filename of this.filesList) {
            const filePath = path.join(this.queueDir, filename);
            try {
                await fs.unlink(filePath);
            }
            catch (error) {
                if (error?.code !== "ENOENT") {
                    console.error(`[LogSense] Failed to delete disk queue file during clear: ${filename}`, error);
                }
            }
        }
        this.filesList.length = 0;
        this.eventMap.clear();
    }
    size() {
        return this.filesList.length;
    }
    isEmpty() {
        return this.filesList.length === 0;
    }
}
exports.DiskQueue = DiskQueue;
//# sourceMappingURL=disk-queue.js.map