import { ActorType, DatabaseOperation, DatabaseType, Environment, EventCategory, EventStatus, HttpMethod, Severity } from "./constants";
export type Json = string | number | boolean | null | Json[] | {
    [key: string]: Json;
};
export type Metadata = Record<string, Json>;
export type Tags = string[];
export interface EventRelationship {
    eventId: string;
    parentEventId?: string;
    requestId?: string;
    sessionId?: string;
    traceId?: string;
    spanId?: string;
    correlationId?: string;
}
export interface TenantContext {
    organizationId: string;
    projectId: string;
    environment: Environment;
    service: string;
    serviceVersion?: string;
    instanceId?: string;
}
export interface Actor {
    type: ActorType;
    id?: string;
    name?: string;
    email?: string;
    role?: string;
}
export interface Resource {
    type: string;
    id?: string;
    name?: string;
}
export interface RuntimeContext {
    hostname?: string;
    ip?: string;
    region?: string;
    os?: string;
    arch?: string;
    nodeVersion?: string;
    sdkVersion?: string;
    pid?: number;
    cpu?: number;
    memory?: number;
}
export interface BaseEvent {
    version: string;
    category: EventCategory;
    type: string;
    action: EventStatus;
    severity: Severity;
    message?: string;
    timestamp: string;
    duration?: number;
    relationships: EventRelationship;
    tenant: TenantContext;
    actor?: Actor;
    resource?: Resource;
    runtime?: RuntimeContext;
    metadata?: Metadata;
    tags?: Tags;
}
export interface HttpContext {
    method: HttpMethod;
    url: string;
    route?: string;
    protocol?: string;
    statusCode?: number;
    requestSize?: number;
    responseSize?: number;
    userAgent?: string;
    referer?: string;
    clientIp?: string;
}
export interface HttpEvent extends BaseEvent {
    category: EventCategory.HTTP;
    http: HttpContext;
}
export interface DatabaseContext {
    provider: DatabaseType;
    operation: DatabaseOperation;
    database?: string;
    schema?: string;
    table?: string;
    collection?: string;
    rowsAffected?: number;
    query?: string;
    success: boolean;
}
export interface DatabaseEvent extends BaseEvent {
    category: EventCategory.DATABASE;
    database: DatabaseContext;
}
export interface CacheContext {
    provider: "redis";
    operation: string;
    key?: string;
    hit?: boolean;
    success: boolean;
}
export interface CacheEvent extends BaseEvent {
    category: EventCategory.CACHE;
    cache: CacheContext;
}
export interface QueueContext {
    provider: string;
    queue: string;
    jobId?: string;
    operation: string;
    success: boolean;
}
export interface QueueEvent extends BaseEvent {
    category: EventCategory.QUEUE;
    queue: QueueContext;
}
export interface ExternalApiContext {
    provider?: string;
    method?: string;
    url: string;
    statusCode?: number;
    success: boolean;
}
export interface ExternalApiEvent extends BaseEvent {
    category: EventCategory.EXTERNAL;
    external: ExternalApiContext;
}
export interface ExceptionContext {
    name: string;
    message: string;
    stack?: string;
    code?: string;
    file?: string;
    line?: number;
}
export interface ExceptionEvent extends BaseEvent {
    category: EventCategory.EXCEPTION;
    exception: ExceptionContext;
}
export interface RuntimeMetricContext {
    cpu?: number;
    memory?: number;
    heapUsed?: number;
    heapTotal?: number;
    eventLoopDelay?: number;
}
export interface RuntimeEvent extends BaseEvent {
    category: EventCategory.RUNTIME;
    runtimeMetrics: RuntimeMetricContext;
}
export interface BusinessEvent extends BaseEvent {
    category: EventCategory.BUSINESS;
}
export interface CustomEvent extends BaseEvent {
    category: EventCategory.CUSTOM;
}
export type Event = HttpEvent | DatabaseEvent | CacheEvent | QueueEvent | ExternalApiEvent | ExceptionEvent | RuntimeEvent | BusinessEvent | CustomEvent;
export type PartialEvent<T extends Event = Event> = Omit<T, "version" | "timestamp" | "relationships" | "tenant"> & Partial<Pick<T, "version" | "timestamp" | "relationships" | "tenant">>;
//# sourceMappingURL=types.d.ts.map