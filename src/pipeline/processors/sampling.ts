import { EventCategory, Severity } from "../../event/constants";
import { Event } from "../../event/types";
import { EventProcessor } from "../processor";

export interface SamplingOptions {
    type?: "fixed" | "adaptive" | "error-first" | "slow-first";
    strategy?: "fixed" | "adaptive" | "error-first" | "slow-first";
    rate?: number; // 0 to 1
    minRate?: number; // 0 to 1 for adaptive/slow-first fallbacks
    maxRate?: number; // 0 to 1 for adaptive
    windowSizeMs?: number;
    maxEventsPerWindow?: number;
    slowThresholdMs?: number; // ms
}

export class SamplingProcessor implements EventProcessor {
    private readonly strategy: "fixed" | "adaptive" | "error-first" | "slow-first";
    private readonly rate: number;
    private readonly minRate: number;
    private readonly maxRate: number;

    // For adaptive sampling
    private readonly windowSizeMs: number;
    private readonly maxEventsPerWindow: number;
    private windowStart = Date.now();
    private eventCount = 0;
    private adaptiveRate: number;

    // For slow-first
    private readonly slowThresholdMs: number;

    constructor(options: SamplingOptions) {
        this.strategy = options.strategy ?? options.type ?? "fixed";
        this.rate = options.rate ?? 1.0;
        this.minRate = options.minRate ?? 0.1;
        this.maxRate = options.maxRate ?? 1.0;
        this.windowSizeMs = options.windowSizeMs ?? 1000;
        this.maxEventsPerWindow = options.maxEventsPerWindow ?? 1000;
        this.slowThresholdMs = options.slowThresholdMs ?? 500;
        this.adaptiveRate = this.rate;
    }

    process(event: Event): Event | null {
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

    private processFixed(event: Event): Event | null {
        const traceId = event.relationships?.traceId;
        if (traceId) {
            const hash = this.hashString(traceId);
            return hash < this.rate ? event : null;
        }

        return Math.random() < this.rate ? event : null;
    }

    private processAdaptive(event: Event): Event | null {
        const now = Date.now();
        if (now - this.windowStart >= this.windowSizeMs) {
            const ratio = this.eventCount / this.maxEventsPerWindow;
            if (ratio > 1.0) {
                // Exceeded limit: decrease sampling rate
                this.adaptiveRate = Math.max(this.minRate, this.adaptiveRate * 0.8);
            } else if (ratio < 0.5) {
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

    private processErrorFirst(event: Event): Event | null {
        if (
            event.severity === Severity.ERROR ||
            event.severity === Severity.FATAL ||
            event.category === EventCategory.EXCEPTION
        ) {
            return event;
        }

        return this.processFixed(event);
    }

    private processSlowFirst(event: Event): Event | null {
        // Keep slow request/operation events
        if (event.duration !== undefined && event.duration >= this.slowThresholdMs) {
            return event;
        }

        // Keep error events
        if (
            event.severity === Severity.ERROR ||
            event.severity === Severity.FATAL ||
            event.category === EventCategory.EXCEPTION
        ) {
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

    private hashString(str: string): number {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash |= 0; // Convert to 32bit integer
        }
        return Math.abs(hash) / 2147483647;
    }
}
