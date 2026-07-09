import {
    ActorType,
    DatabaseOperation,
    DatabaseType,
    Environment,
    EventCategory,
    EventStatus,
    HttpMethod,
    Severity,
} from "./constants";

/* ============================================================
 * Common Types
 * ============================================================ */

export type Json =
    | string
    | number
    | boolean
    | null
    | Json[]
    | { [key: string]: Json };

export type Metadata = Record<string, Json>;

export type Tags = string[];

/* ============================================================
 * Relationships
 * ============================================================ */

export interface EventRelationship {
    eventId: string;
    parentEventId?: string;
    requestId?: string;
    sessionId?: string;
    traceId?: string;
    spanId?: string;
    correlationId?: string;
}

/* ============================================================
 * Tenant
 * ============================================================ */

export interface TenantContext {
    organizationId: string;
    projectId: string;
    environment: Environment;
    service: string;
    serviceVersion?: string;
    instanceId?: string;
}

/* ============================================================
 * Actor
 * ============================================================ */

export interface Actor {
    type: ActorType;
    id?: string;
    name?: string;
    email?: string;
    role?: string;
}

/* ============================================================
 * Resource
 * ============================================================ */

export interface Resource {
    type: string;
    id?: string;
    name?: string;
}

/* ============================================================
 * Runtime Context
 * ============================================================ */

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

/* ============================================================
 * Base Event
 * ============================================================ */

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

/* ============================================================
 * HTTP
 * ============================================================ */

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

/* ============================================================
 * Database
 * ============================================================ */

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

/* ============================================================
 * Cache
 * ============================================================ */

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

/* ============================================================
 * Queue
 * ============================================================ */

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

/* ============================================================
 * External API
 * ============================================================ */

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

/* ============================================================
 * Exception
 * ============================================================ */

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

/* ============================================================
 * Runtime
 * ============================================================ */

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

/* ============================================================
 * Business
 * ============================================================ */

export interface BusinessEvent extends BaseEvent {
    category: EventCategory.BUSINESS;
}

/* ============================================================
 * Onboarding
 * ============================================================ */

export interface OnboardingLocation {
    latitude: number;
    longitude: number;
    city?: string;
    country?: string;
    region?: string;
    ip?: string;
}

export interface OnboardingContext {
    userId: string;
    step: string;
    location?: OnboardingLocation;
    metadata?: Record<string, any>;
}

export interface OnboardingEvent extends BaseEvent {
    category: EventCategory.ONBOARDING;
    onboarding: OnboardingContext;
}

/* ============================================================
 * Custom
 * ============================================================ */

export interface CustomEvent extends BaseEvent {
    category: EventCategory.CUSTOM;
}

/* ============================================================
 * Union
 * ============================================================ */

export type Event =
    | HttpEvent
    | DatabaseEvent
    | CacheEvent
    | QueueEvent
    | ExternalApiEvent
    | ExceptionEvent
    | RuntimeEvent
    | BusinessEvent
    | OnboardingEvent
    | CustomEvent;

/* ============================================================
 * Partial Event
 * Used internally by Builder
 * ============================================================ */

export type PartialEvent<T extends Event = Event> = Omit<
    T,
    | "version"
    | "timestamp"
    | "relationships"
    | "tenant"
> &
    Partial<
        Pick<
            T,
            "version" | "timestamp" | "relationships" | "tenant"
        >
    >;