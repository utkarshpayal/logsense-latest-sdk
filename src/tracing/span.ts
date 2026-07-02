import { generateId } from "../utils/id";
import { nowMs } from "../utils/time";
import { Collector } from "../collector/collector";
import { EventCategory, EventStatus, Severity } from "../event/constants";

export interface SpanEvent {
    name: string;
    timestamp: number;
    attributes?: Record<string, any>;
}

export class Span {
    public readonly spanId: string;
    public readonly traceId: string;
    public readonly parentSpanId?: string;
    public readonly name: string;
    public readonly startTime: number;
    public endTime?: number;
    public duration?: number;
    public status: EventStatus = EventStatus.STARTED;
    public attributes: Record<string, any> = {};
    public events: SpanEvent[] = [];
    private readonly collector: Collector;

    constructor(name: string, collector: Collector, traceId: string, parentSpanId?: string, startTime = nowMs()) {
        this.name = name;
        this.collector = collector;
        this.traceId = traceId;
        if (parentSpanId !== undefined) {
            this.parentSpanId = parentSpanId;
        }
        this.spanId = generateId();
        this.startTime = startTime;
    }

    setAttribute(key: string, value: any): this {
        this.attributes[key] = value;
        return this;
    }

    setAttributes(attributes: Record<string, any>): this {
        this.attributes = { ...this.attributes, ...attributes };
        return this;
    }

    addEvent(name: string, attributes?: Record<string, any>): this {
        this.events.push({
            name,
            timestamp: nowMs(),
            ...(attributes !== undefined ? { attributes } : {}),
        });
        return this;
    }

    recordException(error: Error | unknown): this {
        const err = error instanceof Error ? error : new Error(String(error));
        this.status = EventStatus.FAILED;
        this.addEvent("exception", {
            "exception.type": err.name,
            "exception.message": err.message,
            "exception.stacktrace": err.stack,
        });
        return this;
    }

    end(endTime = nowMs()): void {
        if (this.endTime) return; // Already ended
        this.endTime = endTime;
        this.duration = this.endTime - this.startTime;
        if (this.status === EventStatus.STARTED) {
            this.status = EventStatus.SUCCESS;
        }

        // Collect span telemetry event
        void this.collector.collect({
            category: EventCategory.CUSTOM,
            type: "span",
            action: this.status,
            severity: this.status === EventStatus.FAILED ? Severity.ERROR : Severity.INFO,
            message: `Span ${this.name} ${this.status}`,
            duration: this.duration,
            relationships: {
                eventId: "",
                traceId: this.traceId,
                spanId: this.spanId,
                ...(this.parentSpanId !== undefined ? { parentEventId: this.parentSpanId } : {}),
            },
            metadata: {
                spanName: this.name,
                startTime: this.startTime,
                endTime: this.endTime,
                attributes: this.attributes,
                events: this.events as any,
            }
        });
    }
}
