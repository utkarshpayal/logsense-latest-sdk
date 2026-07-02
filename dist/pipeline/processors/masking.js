"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MaskingProcessor = void 0;
class MaskingProcessor {
    enabled;
    keysSet;
    patternRegexes;
    constructor(options = {}) {
        this.enabled = options.enabled ?? true;
        const keys = options.keys ?? ["password", "token", "cookie", "authorization", "apiKey", "secret", "passwd", "access_token", "client_secret"];
        this.keysSet = new Set(keys.map((k) => k.toLowerCase()));
        this.patternRegexes = (options.patterns ?? []).map((p) => new RegExp(p, "i"));
    }
    process(event) {
        if (!this.enabled) {
            return event;
        }
        // Return a new object with masked properties.
        // We only traverse fields that could contain sensitive information: metadata, http contexts, headers.
        const clonedEvent = { ...event };
        const visited = new WeakSet();
        if (clonedEvent.metadata) {
            clonedEvent.metadata = this.maskValue(clonedEvent.metadata, visited);
        }
        if (clonedEvent.http) {
            clonedEvent.http = this.maskValue(clonedEvent.http, visited);
        }
        return clonedEvent;
    }
    maskValue(val, visited) {
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
        const maskedObj = {};
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
            }
            else {
                maskedObj[k] = this.maskValue(v, visited);
            }
        }
        visited.delete(val);
        return maskedObj;
    }
}
exports.MaskingProcessor = MaskingProcessor;
//# sourceMappingURL=masking.js.map