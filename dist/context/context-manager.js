"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.contextManager = exports.ContextManager = void 0;
const id_1 = require("../utils/id");
const object_1 = require("../utils/object");
const time_1 = require("../utils/time");
const context_store_1 = require("./context-store");
class ContextManager {
    requestCounter = 0;
    /**
     * Create a new RequestContext object.
     */
    create(options) {
        this.requestCounter++;
        return (0, object_1.omitUndefined)({
            requestId: options.requestId ?? (0, id_1.generateId)(),
            traceId: options.traceId ?? (0, id_1.generateId)(),
            sessionId: options.sessionId,
            spanId: options.spanId,
            correlationId: options.correlationId,
            parentEventId: options.parentEventId,
            tenant: options.tenant,
            actor: options.actor,
            startTime: (0, time_1.nowMs)(),
            requestNumber: this.requestCounter,
            metadata: options.metadata ?? {},
        });
    }
    /**
     * Create a context and run the callback inside the storage context.
     */
    run(options, callback) {
        const context = this.create(options);
        return context_store_1.contextStore.run(context, callback);
    }
    /**
     * Get the current RequestContext from the store.
     */
    current() {
        return context_store_1.contextStore.get();
    }
    /**
     * Returns current request duration in milliseconds.
     */
    getDuration() {
        const ctx = context_store_1.contextStore.get();
        if (!ctx) {
            return undefined;
        }
        return (0, time_1.nowMs)() - ctx.startTime;
    }
}
exports.ContextManager = ContextManager;
exports.contextManager = new ContextManager();
//# sourceMappingURL=context-manager.js.map