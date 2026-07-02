export interface TraceContextCarrier {
    [key: string]: any;
}
export interface TracingContextData {
    traceId: string;
    spanId?: string;
    parentSpanId?: string;
}
export declare function injectTraceContext(carrier: TraceContextCarrier, data: TracingContextData): void;
export declare function extractTraceContext(carrier: TraceContextCarrier): TracingContextData | null;
//# sourceMappingURL=trace-context.d.ts.map