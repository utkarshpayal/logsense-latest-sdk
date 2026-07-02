import { Event } from "../../event/types";
import { EventProcessor } from "../processor";

export interface MaskingOptions {
    enabled?: boolean;
    keys?: string[];
    patterns?: string[];
}

export class MaskingProcessor implements EventProcessor {
    private readonly enabled: boolean;
    private readonly keysSet: Set<string>;
    private readonly patternRegexes: RegExp[];

    constructor(options: MaskingOptions = {}) {
        this.enabled = options.enabled ?? true;
        const keys = options.keys ?? ["password", "token", "cookie", "authorization", "apiKey", "secret", "passwd", "access_token", "client_secret"];
        this.keysSet = new Set(keys.map((k) => k.toLowerCase()));
        this.patternRegexes = (options.patterns ?? []).map((p) => new RegExp(p, "i"));
    }

    process(event: Event): Event | null {
        if (!this.enabled) {
            return event;
        }

        // Return a new object with masked properties.
        // We only traverse fields that could contain sensitive information: metadata, http contexts, headers.
        const clonedEvent = { ...event } as any;

        const visited = new WeakSet<object>();

        if (clonedEvent.metadata) {
            clonedEvent.metadata = this.maskValue(clonedEvent.metadata, visited) as Record<string, any>;
        }

        if (clonedEvent.http) {
            clonedEvent.http = this.maskValue(clonedEvent.http, visited) as any;
        }

        return clonedEvent;
    }

    private maskValue(val: unknown, visited: WeakSet<object>): unknown {
        if (val === null || val === undefined) {
            return val;
        }

        if (typeof val !== "object") {
            return val;
        }

        // Avoid circular references
        if (visited.has(val)) {
            return "[Circular]";
        }
        visited.add(val);

        if (Array.isArray(val)) {
            const arr = val.map((item) => this.maskValue(item, visited));
            visited.delete(val);
            return arr;
        }

        const maskedObj: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(val)) {
            const lowerKey = k.toLowerCase();
            let shouldMask = this.keysSet.has(lowerKey);

            if (!shouldMask) {
                for (const regex of this.patternRegexes) {
                    if (regex.test(k)) {
                        shouldMask = true;
                        break;
                    }
                }
            }

            if (shouldMask) {
                maskedObj[k] = "[MASKED]";
            } else {
                maskedObj[k] = this.maskValue(v, visited);
            }
        }

        visited.delete(val);
        return maskedObj;
    }
}
