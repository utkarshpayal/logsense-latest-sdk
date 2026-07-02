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
export interface CreateRequestContextOptions {
    tenant: TenantContext;
    actor?: Actor;
    /**
     * Existing IDs (for distributed tracing)
     */
    requestId?: string;
    traceId?: string;
    sessionId?: string;
    spanId?: string;
    correlationId?: string;
    parentEventId?: string;
    /**
     * Framework specific metadata
     */
    metadata?: Record<string, unknown>;
}
//# sourceMappingURL=request-context.d.ts.map