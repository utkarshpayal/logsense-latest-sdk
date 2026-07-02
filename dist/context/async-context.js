"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.asyncContext = void 0;
const node_async_hooks_1 = require("node:async_hooks");
class AsyncContextManager {
    storage = new node_async_hooks_1.AsyncLocalStorage();
    /**
     * Create a new async context.
     */
    run(context, callback) {
        return this.storage.run(context, callback);
    }
    /**
     * Get current request context.
     */
    get() {
        return this.storage.getStore();
    }
    /**
     * Returns true if currently inside
     * an async request context.
     */
    hasContext() {
        return this.storage.getStore() !== undefined;
    }
    /**
     * Current Request Id
     */
    getRequestId() {
        return this.storage.getStore()?.requestId;
    }
    /**
     * Current Trace Id
     */
    getTraceId() {
        return this.storage.getStore()?.traceId;
    }
    /**
     * Current Session Id
     */
    getSessionId() {
        return this.storage.getStore()?.sessionId;
    }
    /**
     * Current Span Id
     */
    getSpanId() {
        return this.storage.getStore()?.spanId;
    }
    /**
     * Current Correlation Id
     */
    getCorrelationId() {
        return this.storage.getStore()?.correlationId;
    }
    /**
     * Current Parent Event
     */
    getParentEventId() {
        return this.storage.getStore()?.parentEventId;
    }
    /**
     * Current Tenant
     */
    getTenant() {
        return this.storage.getStore()?.tenant;
    }
    /**
     * Current Actor
     */
    getActor() {
        return this.storage.getStore()?.actor;
    }
    /**
     * Replace actor.
     * Useful after authentication.
     */
    setActor(actor) {
        const ctx = this.storage.getStore();
        if (!ctx) {
            return;
        }
        ctx.actor = actor;
    }
    /**
     * Update session.
     * Example:
     * Anonymous -> Logged In
     */
    setSession(sessionId) {
        const ctx = this.storage.getStore();
        if (!ctx) {
            return;
        }
        ctx.sessionId = sessionId;
    }
    /**
     * Add custom metadata.
     */
    setMetadata(key, value) {
        const ctx = this.storage.getStore();
        if (!ctx) {
            return;
        }
        ctx.metadata[key] = value;
    }
    /**
     * Read metadata.
     */
    getMetadata(key) {
        const ctx = this.storage.getStore();
        if (!ctx) {
            return undefined;
        }
        return ctx.metadata[key];
    }
    /**
     * Clear context.
     * Mostly useful for testing.
     */
    disable() {
        this.storage.disable();
    }
}
exports.asyncContext = new AsyncContextManager();
//# sourceMappingURL=async-context.js.map