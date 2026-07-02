import { Span } from "./span";
import { Collector } from "../collector/collector";
export interface SpanOptions {
    parentSpanId?: string;
    traceId?: string;
    startTime?: number;
    attributes?: Record<string, any>;
}
export declare class SpanManager {
    private collector?;
    setCollector(collector: Collector): void;
    /**
     * Start a new span.
     */
    startSpan(name: string, options?: SpanOptions): Span;
    /**
     * Execute a callback within the context of a Span.
     */
    withSpan<T>(span: Span, callback: () => T): T;
    /**
     * Get the current active span.
     */
    currentSpan(): Span | undefined;
}
export declare const spanManager: SpanManager;
//# sourceMappingURL=span-manager.d.ts.map