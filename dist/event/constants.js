"use strict";
/**
 * LogSense SDK
 * Event Constants
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorType = exports.RuntimePlatform = exports.QueueProvider = exports.DatabaseOperation = exports.DatabaseType = exports.HttpMethod = exports.Environment = exports.ActorType = exports.EventStatus = exports.Severity = exports.EventCategory = void 0;
var EventCategory;
(function (EventCategory) {
    EventCategory["HTTP"] = "http";
    EventCategory["AUTH"] = "authentication";
    EventCategory["DATABASE"] = "database";
    EventCategory["CACHE"] = "cache";
    EventCategory["QUEUE"] = "queue";
    EventCategory["RUNTIME"] = "runtime";
    EventCategory["EXCEPTION"] = "exception";
    EventCategory["EXTERNAL"] = "external";
    EventCategory["BUSINESS"] = "business";
    EventCategory["ONBOARDING"] = "onboarding";
    EventCategory["PAYMENT"] = "payment";
    EventCategory["DEPLOYMENT"] = "deployment";
    EventCategory["SECURITY"] = "security";
    EventCategory["AI"] = "ai";
    EventCategory["CUSTOM"] = "custom";
})(EventCategory || (exports.EventCategory = EventCategory = {}));
var Severity;
(function (Severity) {
    Severity["TRACE"] = "trace";
    Severity["DEBUG"] = "debug";
    Severity["INFO"] = "info";
    Severity["WARN"] = "warn";
    Severity["ERROR"] = "error";
    Severity["FATAL"] = "fatal";
})(Severity || (exports.Severity = Severity = {}));
var EventStatus;
(function (EventStatus) {
    EventStatus["STARTED"] = "started";
    EventStatus["SUCCESS"] = "success";
    EventStatus["COMPLETED"] = "completed";
    EventStatus["FAILED"] = "failed";
    EventStatus["CANCELLED"] = "cancelled";
    EventStatus["TIMEOUT"] = "timeout";
})(EventStatus || (exports.EventStatus = EventStatus = {}));
var ActorType;
(function (ActorType) {
    ActorType["USER"] = "user";
    ActorType["ADMIN"] = "admin";
    ActorType["SYSTEM"] = "system";
    ActorType["WORKER"] = "worker";
    ActorType["CRON"] = "cron";
    ActorType["API_KEY"] = "api-key";
    ActorType["ANONYMOUS"] = "anonymous";
})(ActorType || (exports.ActorType = ActorType = {}));
var Environment;
(function (Environment) {
    Environment["DEVELOPMENT"] = "development";
    Environment["TEST"] = "test";
    Environment["STAGING"] = "staging";
    Environment["PRODUCTION"] = "production";
})(Environment || (exports.Environment = Environment = {}));
var HttpMethod;
(function (HttpMethod) {
    HttpMethod["GET"] = "GET";
    HttpMethod["POST"] = "POST";
    HttpMethod["PUT"] = "PUT";
    HttpMethod["PATCH"] = "PATCH";
    HttpMethod["DELETE"] = "DELETE";
    HttpMethod["OPTIONS"] = "OPTIONS";
    HttpMethod["HEAD"] = "HEAD";
})(HttpMethod || (exports.HttpMethod = HttpMethod = {}));
var DatabaseType;
(function (DatabaseType) {
    DatabaseType["POSTGRES"] = "postgres";
    DatabaseType["MYSQL"] = "mysql";
    DatabaseType["SQLITE"] = "sqlite";
    DatabaseType["MONGODB"] = "mongodb";
    DatabaseType["REDIS"] = "redis";
})(DatabaseType || (exports.DatabaseType = DatabaseType = {}));
var DatabaseOperation;
(function (DatabaseOperation) {
    DatabaseOperation["SELECT"] = "SELECT";
    DatabaseOperation["INSERT"] = "INSERT";
    DatabaseOperation["UPDATE"] = "UPDATE";
    DatabaseOperation["DELETE"] = "DELETE";
    DatabaseOperation["UPSERT"] = "UPSERT";
    DatabaseOperation["CREATE"] = "CREATE";
    DatabaseOperation["DROP"] = "DROP";
    DatabaseOperation["ALTER"] = "ALTER";
})(DatabaseOperation || (exports.DatabaseOperation = DatabaseOperation = {}));
var QueueProvider;
(function (QueueProvider) {
    QueueProvider["BULLMQ"] = "bullmq";
    QueueProvider["RABBITMQ"] = "rabbitmq";
    QueueProvider["KAFKA"] = "kafka";
    QueueProvider["SQS"] = "aws-sqs";
    QueueProvider["REDIS"] = "redis";
})(QueueProvider || (exports.QueueProvider = QueueProvider = {}));
var RuntimePlatform;
(function (RuntimePlatform) {
    RuntimePlatform["NODE"] = "node";
    RuntimePlatform["BROWSER"] = "browser";
})(RuntimePlatform || (exports.RuntimePlatform = RuntimePlatform = {}));
var ErrorType;
(function (ErrorType) {
    ErrorType["VALIDATION"] = "validation";
    ErrorType["DATABASE"] = "database";
    ErrorType["NETWORK"] = "network";
    ErrorType["AUTHORIZATION"] = "authorization";
    ErrorType["AUTHENTICATION"] = "authentication";
    ErrorType["INTERNAL"] = "internal";
    ErrorType["UNKNOWN"] = "unknown";
})(ErrorType || (exports.ErrorType = ErrorType = {}));
//# sourceMappingURL=constants.js.map