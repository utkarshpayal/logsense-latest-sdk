import { AsyncLocalStorage } from "node:async_hooks";

import { Actor } from "../event/types";
import { RequestContext } from "./request-context";

export class ContextStore {
    private readonly storage = new AsyncLocalStorage<RequestContext>();

    /**
     * Run callback within a request context.
     */
    run<T>(context: RequestContext, callback: () => T): T {
        return this.storage.run(context, callback);
    }

    /**
     * Get the current request context.
     */
    get(): RequestContext | undefined {
        return this.storage.getStore();
    }

    /**
     * Returns true if currently inside an active context.
     */
    hasContext(): boolean {
        return this.storage.getStore() !== undefined;
    }

    /**
     * Replace actor (e.g. after authentication).
     */
    setActor(actor: Actor): void {
        const ctx = this.storage.getStore();
        if (ctx) {
            ctx.actor = actor;
        }
    }

    /**
     * Update session ID.
     */
    setSession(sessionId: string): void {
        const ctx = this.storage.getStore();
        if (ctx) {
            ctx.sessionId = sessionId;
        }
    }

    /**
     * Add custom metadata.
     */
    setMetadata(key: string, value: unknown): void {
        const ctx = this.storage.getStore();
        if (ctx) {
            ctx.metadata[key] = value;
        }
    }

    /**
     * Read custom metadata.
     */
    getMetadata<T = unknown>(key: string): T | undefined {
        const ctx = this.storage.getStore();
        if (!ctx) {
            return undefined;
        }
        return ctx.metadata[key] as T;
    }

    /**
     * Disable storage (mainly for testing/cleanup).
     */
    disable(): void {
        this.storage.disable();
    }
}

export const contextStore = new ContextStore();
