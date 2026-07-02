"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventBuilder = void 0;
const node_os_1 = require("node:os");
const id_1 = require("../utils/id");
const object_1 = require("../utils/object");
const time_1 = require("../utils/time");
const constants_1 = require("./constants");
const context_store_1 = require("../context/context-store");
class EventBuilder {
    options;
    constructor(options) {
        this.options = options;
    }
    /**
     * Build a complete event from a partial event.
     */
    build(event) {
        const timestamp = (0, time_1.now)();
        const activeCtx = context_store_1.contextStore.get();
        const relationships = (0, object_1.omitUndefined)({
            eventId: (0, id_1.generateId)(),
            parentEventId: event.relationships?.parentEventId ?? activeCtx?.parentEventId,
            requestId: event.relationships?.requestId ??
                activeCtx?.requestId ??
                this.options.relationships?.requestId,
            sessionId: event.relationships?.sessionId ??
                activeCtx?.sessionId ??
                this.options.relationships?.sessionId,
            traceId: event.relationships?.traceId ??
                activeCtx?.traceId ??
                this.options.relationships?.traceId,
            spanId: event.relationships?.spanId ??
                activeCtx?.spanId ??
                this.options.relationships?.spanId,
            correlationId: event.relationships?.correlationId ??
                activeCtx?.correlationId ??
                this.options.relationships?.correlationId,
        });
        const runtime = {
            hostname: (0, node_os_1.hostname)(),
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
        const builtEvent = (0, object_1.omitUndefined)({
            version: event.version ?? "1.0.0",
            category: event.category,
            type: event.type,
            action: event.action,
            severity: event.severity ?? constants_1.Severity.INFO,
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
        });
        return {
            ...builtEvent,
            ...event,
            tenant: builtEvent.tenant,
            runtime,
            relationships,
            timestamp: builtEvent.timestamp,
            version: builtEvent.version,
            severity: builtEvent.severity,
        };
    }
}
exports.EventBuilder = EventBuilder;
//# sourceMappingURL=builder.js.map