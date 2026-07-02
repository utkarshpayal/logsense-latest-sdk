import { hostname } from "node:os";

import { generateId } from "../utils/id";
import { omitUndefined } from "../utils/object";
import { now } from "../utils/time";
import { Severity } from "./constants";
import {
    BaseEvent,
    Event,
    EventRelationship,
    PartialEvent,
    RuntimeContext,
    TenantContext,
} from "./types";
import { contextStore } from "../context/context-store";

export interface EventBuilderOptions {
    sdkVersion: string;

    tenant: TenantContext;

    runtime?: Partial<RuntimeContext>;

    relationships?: Partial<EventRelationship>;
}

export class EventBuilder {
    private readonly options: EventBuilderOptions;

    constructor(options: EventBuilderOptions) {
        this.options = options;
    }

    /**
     * Build a complete event from a partial event.
     */
    build<T extends Event>(event: PartialEvent<T>): T {
        const timestamp = now();
        const activeCtx = contextStore.get();

        const relationships: EventRelationship = omitUndefined({
            eventId: generateId(),

            parentEventId: event.relationships?.parentEventId ?? activeCtx?.parentEventId,

            requestId:
                event.relationships?.requestId ??
                activeCtx?.requestId ??
                this.options.relationships?.requestId,

            sessionId:
                event.relationships?.sessionId ??
                activeCtx?.sessionId ??
                this.options.relationships?.sessionId,

            traceId:
                event.relationships?.traceId ??
                activeCtx?.traceId ??
                this.options.relationships?.traceId,

            spanId:
                event.relationships?.spanId ??
                activeCtx?.spanId ??
                this.options.relationships?.spanId,

            correlationId:
                event.relationships?.correlationId ??
                activeCtx?.correlationId ??
                this.options.relationships?.correlationId,
        }) as EventRelationship;

        const runtime: RuntimeContext = {
            hostname: hostname(),

            sdkVersion: this.options.sdkVersion,

            ...this.options.runtime,

            ...event.runtime,
        };

        const activeActor = event.actor ?? activeCtx?.actor;
        const activeTenant = {
            ...this.options.tenant,
            ...activeCtx?.tenant,
            ...event.tenant,
        };

        const builtEvent: BaseEvent = omitUndefined({
            version: event.version ?? "1.0.0",

            category: event.category,

            type: event.type,

            action: event.action,

            severity: event.severity ?? Severity.INFO,

            message: event.message,

            timestamp: event.timestamp ?? timestamp,

            duration: event.duration,

            tenant: activeTenant,

            relationships,

            runtime,

            actor: activeActor,

            resource: event.resource,

            metadata: event.metadata,

            tags: event.tags,
        }) as BaseEvent;

        return {
            ...builtEvent,
            ...event,
            tenant: builtEvent.tenant,
            runtime,
            relationships,
            timestamp: builtEvent.timestamp,
            version: builtEvent.version,
            severity: builtEvent.severity,
        } as T;
    }
}