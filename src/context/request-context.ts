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