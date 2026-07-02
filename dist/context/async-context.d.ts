import { Actor, TenantContext } from "../event/types";
export interface RequestContext {
    requestId: string;
    traceId: string;
    sessionId?: string;
    spanId?: string;
    correlationId?: string;
    parentEventId?: string;
    tenant: TenantContext;
    actor?: Actor;
    startTime: number;
    requestNumber: number;
    metadata: Record<string, unknown>;
}
declare class AsyncContextManager {
    private readonly storage;
    /**
     * Create a new async context.
     */
    run<T>(context: RequestContext, callback: () => T): T;
    /**
     * Get current request context.
     */
    get(): RequestContext | undefined;
    /**
     * Returns true if currently inside
     * an async request context.
     */
    hasContext(): boolean;
    /**
     * Current Request Id
     */
    getRequestId(): string | undefined;
    /**
     * Current Trace Id
     */
    getTraceId(): string | undefined;
    /**
     * Current Session Id
     */
    getSessionId(): string | undefined;
    /**
     * Current Span Id
     */
    getSpanId(): string | undefined;
    /**
     * Current Correlation Id
     */
    getCorrelationId(): string | undefined;
    /**
     * Current Parent Event
     */
    getParentEventId(): string | undefined;
    /**
     * Current Tenant
     */
    getTenant(): TenantContext | undefined;
    /**
     * Current Actor
     */
    getActor(): Actor | undefined;
    /**
     * Replace actor.
     * Useful after authentication.
     */
    setActor(actor: Actor): void;
    /**
     * Update session.
     * Example:
     * Anonymous -> Logged In
     */
    setSession(sessionId: string): void;
    /**
     * Add custom metadata.
     */
    setMetadata(key: string, value: unknown): void;
    /**
     * Read metadata.
     */
    getMetadata<T = unknown>(key: string): T | undefined;
    /**
     * Clear context.
     * Mostly useful for testing.
     */
    disable(): void;
}
export declare const asyncContext: AsyncContextManager;
export {};
//# sourceMappingURL=async-context.d.ts.map