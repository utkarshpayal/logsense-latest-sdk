/**
 * LogSense SDK
 * Event Constants
 */
export declare enum EventCategory {
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
    CUSTOM = "custom"
}
export declare enum Severity {
    TRACE = "trace",
    DEBUG = "debug",
    INFO = "info",
    WARN = "warn",
    ERROR = "error",
    FATAL = "fatal"
}
export declare enum EventStatus {
    STARTED = "started",
    SUCCESS = "success",
    COMPLETED = "completed",
    FAILED = "failed",
    CANCELLED = "cancelled",
    TIMEOUT = "timeout"
}
export declare enum ActorType {
    USER = "user",
    ADMIN = "admin",
    SYSTEM = "system",
    WORKER = "worker",
    CRON = "cron",
    API_KEY = "api-key",
    ANONYMOUS = "anonymous"
}
export declare enum Environment {
    DEVELOPMENT = "development",
    TEST = "test",
    STAGING = "staging",
    PRODUCTION = "production"
}
export declare enum HttpMethod {
    GET = "GET",
    POST = "POST",
    PUT = "PUT",
    PATCH = "PATCH",
    DELETE = "DELETE",
    OPTIONS = "OPTIONS",
    HEAD = "HEAD"
}
export declare enum DatabaseType {
    POSTGRES = "postgres",
    MYSQL = "mysql",
    SQLITE = "sqlite",
    MONGODB = "mongodb",
    REDIS = "redis"
}
export declare enum DatabaseOperation {
    SELECT = "SELECT",
    INSERT = "INSERT",
    UPDATE = "UPDATE",
    DELETE = "DELETE",
    UPSERT = "UPSERT",
    CREATE = "CREATE",
    DROP = "DROP",
    ALTER = "ALTER"
}
export declare enum QueueProvider {
    BULLMQ = "bullmq",
    RABBITMQ = "rabbitmq",
    KAFKA = "kafka",
    SQS = "aws-sqs",
    REDIS = "redis"
}
export declare enum RuntimePlatform {
    NODE = "node",
    BROWSER = "browser"
}
export declare enum ErrorType {
    VALIDATION = "validation",
    DATABASE = "database",
    NETWORK = "network",
    AUTHORIZATION = "authorization",
    AUTHENTICATION = "authentication",
    INTERNAL = "internal",
    UNKNOWN = "unknown"
}
//# sourceMappingURL=constants.d.ts.map