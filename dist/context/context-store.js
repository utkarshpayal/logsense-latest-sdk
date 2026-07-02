"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.contextStore = exports.ContextStore = void 0;
const node_async_hooks_1 = require("node:async_hooks");
class ContextStore {
    storage = new node_async_hooks_1.AsyncLocalStorage();
    /**
     * Run callback within a request context.
     */
    run(context, callback) {
        return this.storage.run(context, callback);
    }
    /**
     * Get the current request context.
     */
    get() {
        return this.storage.getStore();
    }
    /**
     * Returns true if currently inside an active context.
     */
    hasContext() {
        return this.storage.getStore() !== undefined;
    }
    /**
     * Replace actor (e.g. after authentication).
     */
    setActor(actor) {
        const ctx = this.storage.getStore();
        if (ctx) {
            ctx.actor = actor;
        }
    }
    /**
     * Update session ID.
     */
    setSession(sessionId) {
        const ctx = this.storage.getStore();
        if (ctx) {
            ctx.sessionId = sessionId;
        }
    }
    /**
     * Add custom metadata.
     */
    setMetadata(key, value) {
        const ctx = this.storage.getStore();
        if (ctx) {
            ctx.metadata[key] = value;
        }
    }
    /**
     * Read custom metadata.
     */
    getMetadata(key) {
        const ctx = this.storage.getStore();
        if (!ctx) {
            return undefined;
        }
        return ctx.metadata[key];
    }
    /**
     * Disable storage (mainly for testing/cleanup).
     */
    disable() {
        this.storage.disable();
    }
}
exports.ContextStore = ContextStore;
exports.contextStore = new ContextStore();
//# sourceMappingURL=context-store.js.map