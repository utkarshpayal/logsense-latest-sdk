import { Collector } from "../collector/collector";
import { EventStatus } from "../event/constants";
export interface SpanEvent {
    name: string;
    timestamp: number;
    attributes?: Record<string, any>;
}
export declare class Span {
    readonly spanId: string;
    readonly traceId: string;
    readonly parentSpanId?: string;
    readonly name: string;
    readonly startTime: number;
    endTime?: number;
    duration?: number;
    status: EventStatus;
    attributes: Record<string, any>;
    events: SpanEvent[];
    private readonly collector;
    constructor(name: string, collector: Collector, traceId: string, parentSpanId?: string, startTime?: number);
    setAttribute(key: string, value: any): this;
    setAttributes(attributes: Record<string, any>): this;
    addEvent(name: string, attributes?: Record<string, any>): this;
    recordException(error: Error | unknown): this;
    end(endTime?: number): void;
}
//# sourceMappingURL=span.d.ts.map