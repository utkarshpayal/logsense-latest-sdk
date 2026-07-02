import { Event, EventRelationship, PartialEvent, RuntimeContext, TenantContext } from "./types";
export interface EventBuilderOptions {
    sdkVersion: string;
    tenant: TenantContext;
    runtime?: Partial<RuntimeContext>;
    relationships?: Partial<EventRelationship>;
}
export declare class EventBuilder {
    private readonly options;
    constructor(options: EventBuilderOptions);
    /**
     * Build a complete event from a partial event.
     */
    build<T extends Event>(event: PartialEvent<T>): T;
}
//# sourceMappingURL=builder.d.ts.map