import { AsyncLocalStorage } from "node:async_hooks";

import { Actor, TenantContext } from "../event/types";

export interface RequestContext {
    // ==========================================================
    // Relationships
    // ==========================================================

    requestId: string;
    traceId: string;
    sessionId?: string;
    spanId?: string;
    correlationId?: string;
    parentEventId?: string;

    // ==========================================================
    // Tenant
    // ==========================================================

    tenant: TenantContext;

    // ==========================================================
    // Actor
    // ==========================================================

    actor?: Actor;

    // ==========================================================
    // Request Metadata
    // ==========================================================

    startTime: number;
    requestNumber: number;
    metadata: Record<string, unknown>;
}

class AsyncContextManager {
    private readonly storage =
        new AsyncLocalStorage<RequestContext>();

    /**
     * Create a new async context.
     */
    run<T>(
        context: RequestContext,
        callback: () => T,
    ): T {
        return this.storage.run(context, callback);
    }

    /**
     * Get current request context.
     */
    get(): RequestContext | undefined {
        return this.storage.getStore();
    }

    /**
     * Returns true if currently inside
     * an async request context.
     */
    hasContext(): boolean {
        return this.storage.getStore() !== undefined;
    }

    /**
     * Current Request Id
     */
    getRequestId(): string | undefined {
        return this.storage.getStore()?.requestId;
    }

    /**
     * Current Trace Id
     */
    getTraceId(): string | undefined {
        return this.storage.getStore()?.traceId;
    }

    /**
     * Current Session Id
     */
    getSessionId(): string | undefined {
        return this.storage.getStore()?.sessionId;
    }

    /**
     * Current Span Id
     */
    getSpanId(): string | undefined {
        return this.storage.getStore()?.spanId;
    }

    /**
     * Current Correlation Id
     */
    getCorrelationId(): string | undefined {
        return this.storage.getStore()?.correlationId;
    }

    /**
     * Current Parent Event
     */
    getParentEventId(): string | undefined {
        return this.storage.getStore()?.parentEventId;
    }

    /**
     * Current Tenant
     */
    getTenant(): TenantContext | undefined {
        return this.storage.getStore()?.tenant;
    }

    /**
     * Current Actor
     */
    getActor(): Actor | undefined {
        return this.storage.getStore()?.actor;
    }

    /**
     * Replace actor.
     * Useful after authentication.
     */
    setActor(actor: Actor): void {
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
    setSession(sessionId: string): void {
        const ctx = this.storage.getStore();

        if (!ctx) {
            return;
        }

        ctx.sessionId = sessionId;
    }

    /**
     * Add custom metadata.
     */
    setMetadata(
        key: string,
        value: unknown,
    ): void {
        const ctx = this.storage.getStore();

        if (!ctx) {
            return;
        }

        ctx.metadata[key] = value;
    }

    /**
     * Read metadata.
     */
    getMetadata<T = unknown>(
        key: string,
    ): T | undefined {
        const ctx = this.storage.getStore();

        if (!ctx) {
            return undefined;
        }

        return ctx.metadata[key] as T;
    }

    /**
     * Clear context.
     * Mostly useful for testing.
     */
    disable(): void {
        this.storage.disable();
    }
}

export const asyncContext =
    new AsyncContextManager();