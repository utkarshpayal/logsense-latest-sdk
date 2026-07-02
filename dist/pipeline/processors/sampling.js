"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SamplingProcessor = void 0;
const constants_1 = require("../../event/constants");
class SamplingProcessor {
    strategy;
    rate;
    minRate;
    maxRate;
    // For adaptive sampling
    windowSizeMs;
    maxEventsPerWindow;
    windowStart = Date.now();
    eventCount = 0;
    adaptiveRate;
    // For slow-first
    slowThresholdMs;
    constructor(options) {
        this.strategy = options.strategy ?? options.type ?? "fixed";
        this.rate = options.rate ?? 1.0;
        this.minRate = options.minRate ?? 0.1;
        this.maxRate = options.maxRate ?? 1.0;
        this.windowSizeMs = options.windowSizeMs ?? 1000;
        this.maxEventsPerWindow = options.maxEventsPerWindow ?? 1000;
        this.slowThresholdMs = options.slowThresholdMs ?? 500;
        this.adaptiveRate = this.rate;
    }
    process(event) {
        switch (this.strategy) {
            case "error-first":
                return this.processErrorFirst(event);
            case "slow-first":
                return this.processSlowFirst(event);
            case "adaptive":
                return this.processAdaptive(event);
            case "fixed":
            default:
                return this.processFixed(event);
        }
    }
    processFixed(event) {
        const traceId = event.relationships?.traceId;
        if (traceId) {
            const hash = this.hashString(traceId);
            return hash < this.rate ? event : null;
        }
        return Math.random() < this.rate ? event : null;
    }
    processAdaptive(event) {
        const now = Date.now();
        if (now - this.windowStart >= this.windowSizeMs) {
            const ratio = this.eventCount / this.maxEventsPerWindow;
            if (ratio > 1.0) {
                // Exceeded limit: decrease sampling rate
                this.adaptiveRate = Math.max(this.minRate, this.adaptiveRate * 0.8);
            }
            else if (ratio < 0.5) {
                // Low load: increase sampling rate
                this.adaptiveRate = Math.min(this.maxRate, this.adaptiveRate * 1.2);
            }
            this.windowStart = now;
            this.eventCount = 0;
        }
        this.eventCount++;
        const traceId = event.relationships?.traceId;
        if (traceId) {
            const hash = this.hashString(traceId);
            return hash < this.adaptiveRate ? event : null;
        }
        return Math.random() < this.adaptiveRate ? event : null;
    }
    processErrorFirst(event) {
        if (event.severity === constants_1.Severity.ERROR ||
            event.severity === constants_1.Severity.FATAL ||
            event.category === constants_1.EventCategory.EXCEPTION) {
            return event;
        }
        return this.processFixed(event);
    }
    processSlowFirst(event) {
        // Keep slow request/operation events
        if (event.duration !== undefined && event.duration >= this.slowThresholdMs) {
            return event;
        }
        // Keep error events
        if (event.severity === constants_1.Severity.ERROR ||
            event.severity === constants_1.Severity.FATAL ||
            event.category === constants_1.EventCategory.EXCEPTION) {
            return event;
        }
        // Otherwise fallback to basic rate/minRate
        const fallbackRate = this.rate !== 1.0 ? this.rate : this.minRate;
        const traceId = event.relationships?.traceId;
        if (traceId) {
            const hash = this.hashString(traceId);
            return hash < fallbackRate ? event : null;
        }
        return Math.random() < fallbackRate ? event : null;
    }
    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash |= 0; // Convert to 32bit integer
        }
        return Math.abs(hash) / 2147483647;
    }
}
exports.SamplingProcessor = SamplingProcessor;
//# sourceMappingURL=sampling.js.map