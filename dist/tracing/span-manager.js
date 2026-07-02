"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.spanManager = exports.SpanManager = void 0;
const span_1 = require("./span");
const context_store_1 = require("../context/context-store");
const id_1 = require("../utils/id");
class SpanManager {
    collector;
    setCollector(collector) {
        this.collector = collector;
    }
    /**
     * Start a new span.
     */
    startSpan(name, options) {
        if (!this.collector) {
            throw new Error("[LogSense] SpanManager has not been initialized with a collector.");
        }
        const activeCtx = context_store_1.contextStore.get();
        // Resolve traceId
        let traceId = options?.traceId;
        if (!traceId) {
            traceId = activeCtx?.traceId || (0, id_1.generateId)();
        }
        // Resolve parentSpanId
        let parentSpanId = options?.parentSpanId;
        if (!parentSpanId) {
            const currentActiveSpan = activeCtx?.metadata?._activeSpan;
            parentSpanId = currentActiveSpan?.spanId || activeCtx?.spanId || activeCtx?.parentEventId;
        }
        const span = new span_1.Span(name, this.collector, traceId, parentSpanId, options?.startTime);
        if (options?.attributes) {
            span.setAttributes(options.attributes);
        }
        return span;
    }
    /**
     * Execute a callback within the context of a Span.
     */
    withSpan(span, callback) {
        const activeCtx = context_store_1.contextStore.get();
        if (activeCtx) {
            const originalSpan = activeCtx.metadata._activeSpan;
            activeCtx.metadata._activeSpan = span;
            const originalSpanId = activeCtx.spanId;
            activeCtx.spanId = span.spanId;
            try {
                return callback();
            }
            finally {
                activeCtx.metadata._activeSpan = originalSpan;
                if (originalSpanId === undefined) {
                    delete activeCtx.spanId;
                }
                else {
                    activeCtx.spanId = originalSpanId;
                }
            }
        }
        else {
            return context_store_1.contextStore.run({
                requestId: (0, id_1.generateId)(),
                traceId: span.traceId,
                spanId: span.spanId,
                tenant: {
                    organizationId: "",
                    projectId: "",
                    environment: "development",
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
    currentSpan() {
        const activeCtx = context_store_1.contextStore.get();
        return activeCtx?.metadata?._activeSpan;
    }
}
exports.SpanManager = SpanManager;
exports.spanManager = new SpanManager();
//# sourceMappingURL=span-manager.js.map