/**
 * LogSense SDK
 * Event Constants
 */

export enum EventCategory {
    HTTP = "http",
    AUTH = "authentication",
    DATABASE = "database",
    CACHE = "cache",
    QUEUE = "queue",
    RUNTIME = "runtime",
    EXCEPTION = "exception",
    EXTERNAL = "external",
    BUSINESS = "business",
    ONBOARDING = "onboarding",
    PAYMENT = "payment",
    DEPLOYMENT = "deployment",
    SECURITY = "security",
    AI = "ai",
    CUSTOM = "custom",
}

export enum Severity {
    TRACE = "trace",
    DEBUG = "debug",
    INFO = "info",
    WARN = "warn",
    ERROR = "error",
    FATAL = "fatal",
}

export enum EventStatus {
    STARTED = "started",
    SUCCESS = "success",
    COMPLETED = "completed",
    FAILED = "failed",
    CANCELLED = "cancelled",
    TIMEOUT = "timeout",
}

export enum ActorType {
    USER = "user",
    ADMIN = "admin",
    SYSTEM = "system",
    WORKER = "worker",
    CRON = "cron",
    API_KEY = "api-key",
    ANONYMOUS = "anonymous",
}

export enum Environment {
    DEVELOPMENT = "development",
    TEST = "test",
    STAGING = "staging",
    PRODUCTION = "production",
}

export enum HttpMethod {
    GET = "GET",
    POST = "POST",
    PUT = "PUT",
    PATCH = "PATCH",
    DELETE = "DELETE",
    OPTIONS = "OPTIONS",
    HEAD = "HEAD",
}

export enum DatabaseType {
    POSTGRES = "postgres",
    MYSQL = "mysql",
    SQLITE = "sqlite",
    MONGODB = "mongodb",
    REDIS = "redis",
}

export enum DatabaseOperation {
    SELECT = "SELECT",
    INSERT = "INSERT",
    UPDATE = "UPDATE",
    DELETE = "DELETE",
    UPSERT = "UPSERT",
    CREATE = "CREATE",
    DROP = "DROP",
    ALTER = "ALTER",
}

export enum QueueProvider {
    BULLMQ = "bullmq",
    RABBITMQ = "rabbitmq",
    KAFKA = "kafka",
    SQS = "aws-sqs",
    REDIS = "redis",
}

export enum RuntimePlatform {
    NODE = "node",
    BROWSER = "browser",
}

export enum ErrorType {
    VALIDATION = "validation",
    DATABASE = "database",
    NETWORK = "network",
    AUTHORIZATION = "authorization",
    AUTHENTICATION = "authentication",
    INTERNAL = "internal",
    UNKNOWN = "unknown",
}