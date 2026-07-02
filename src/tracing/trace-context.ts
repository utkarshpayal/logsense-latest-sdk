export interface TraceContextCarrier {
    [key: string]: any;
}

export interface TracingContextData {
    traceId: string;
    spanId?: string;
    parentSpanId?: string;
}

export function injectTraceContext(carrier: TraceContextCarrier, data: TracingContextData): void {
    carrier["x-trace-id"] = data.traceId;
    if (data.spanId) {
        carrier["x-span-id"] = data.spanId;
    }
    if (data.parentSpanId) {
        carrier["x-parent-span-id"] = data.parentSpanId;
    }
}

export function extractTraceContext(carrier: TraceContextCarrier): TracingContextData | null {
    const traceId = carrier["x-trace-id"] || carrier["X-Trace-Id"] || carrier["x-request-id"] || carrier["X-Request-Id"];
    if (!traceId) {
        return null;
    }
    const spanVal = carrier["x-span-id"] || carrier["X-Span-Id"];
    const parentVal = carrier["x-parent-span-id"] || carrier["X-Parent-Span-Id"];
    return {
        traceId: String(traceId),
        ...(spanVal ? { spanId: String(spanVal) } : {}),
        ...(parentVal ? { parentSpanId: String(parentVal) } : {}),
    };
}
