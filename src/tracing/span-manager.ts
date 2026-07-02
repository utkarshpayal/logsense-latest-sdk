import { Span } from "./span";
import { contextStore } from "../context/context-store";
import { Collector } from "../collector/collector";
import { generateId } from "../utils/id";

export interface SpanOptions {
    parentSpanId?: string;
    traceId?: string;
    startTime?: number;
    attributes?: Record<string, any>;
}

export class SpanManager {
    private collector?: Collector;

    setCollector(collector: Collector): void {
        this.collector = collector;
    }

    /**
     * Start a new span.
     */
    startSpan(name: string, options?: SpanOptions): Span {
        if (!this.collector) {
            throw new Error("[LogSense] SpanManager has not been initialized with a collector.");
        }

        const activeCtx = contextStore.get();
        
        // Resolve traceId
        let traceId = options?.traceId;
        if (!traceId) {
            traceId = activeCtx?.traceId || generateId();
        }

        // Resolve parentSpanId
        let parentSpanId = options?.parentSpanId;
        if (!parentSpanId) {
            const currentActiveSpan = activeCtx?.metadata?._activeSpan as Span | undefined;
            parentSpanId = currentActiveSpan?.spanId || activeCtx?.spanId || activeCtx?.parentEventId;
        }

        const span = new Span(name, this.collector, traceId, parentSpanId, options?.startTime);
        if (options?.attributes) {
            span.setAttributes(options.attributes);
        }

        return span;
    }

    /**
     * Execute a callback within the context of a Span.
     */
    withSpan<T>(span: Span, callback: () => T): T {
        const activeCtx = contextStore.get();
        if (activeCtx) {
            const originalSpan = activeCtx.metadata._activeSpan;
            activeCtx.metadata._activeSpan = span;
            const originalSpanId = activeCtx.spanId;
            activeCtx.spanId = span.spanId;

            try {
                return callback();
            } finally {
                activeCtx.metadata._activeSpan = originalSpan;
                if (originalSpanId === undefined) {
                    delete activeCtx.spanId;
                } else {
                    activeCtx.spanId = originalSpanId;
                }
            }
        } else {
            return contextStore.run({
                requestId: generateId(),
                traceId: span.traceId,
                spanId: span.spanId,
                tenant: {
                    organizationId: "",
                    projectId: "",
                    environment: "development" as any,
                    service: "",
                },
                startTime: Date.now(),
                requestNumber: 0,
                metadata: {
                    _activeSpan: span,
                }
            }, callback);
        }
    }

    /**
     * Get the current active span.
     */
    currentSpan(): Span | undefined {
        const activeCtx = contextStore.get();
        return activeCtx?.metadata?._activeSpan as Span | undefined;
    }
}

export const spanManager = new SpanManager();
