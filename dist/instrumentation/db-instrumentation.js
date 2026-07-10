"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prismaLogSenseExtension = prismaLogSenseExtension;
exports.mongooseLogSensePlugin = mongooseLogSensePlugin;
exports.wrapPg = wrapPg;
exports.wrapMysql2 = wrapMysql2;
const constants_1 = require("../event/constants");
const context_store_1 = require("../context/context-store");
// ============================================================================
// 1. Prisma Client Extension
// ============================================================================
function prismaLogSenseExtension(collector, provider = constants_1.DatabaseType.POSTGRES) {
    return (client) => {
        return client.$extends({
            name: "logsense-prisma",
            query: {
                async $allOperations({ model, operation, args, query }) {
                    const start = Date.now();
                    const activeCtx = context_store_1.contextStore.get();
                    const relationships = activeCtx
                        ? {
                            traceId: activeCtx.traceId,
                            requestId: activeCtx.requestId,
                            parentEventId: activeCtx.spanId || activeCtx.parentEventId,
                            ...(activeCtx.spanId ? { spanId: activeCtx.spanId } : {}),
                            ...(activeCtx.sessionId ? { sessionId: activeCtx.sessionId } : {}),
                        }
                        : undefined;
                    try {
                        const result = await query(args);
                        const duration = Date.now() - start;
                        void collector.collect({
                            category: constants_1.EventCategory.DATABASE,
                            type: "db.query",
                            action: constants_1.EventStatus.COMPLETED,
                            severity: constants_1.Severity.INFO,
                            message: `Prisma ${model ? model + "." : ""}${operation} succeeded`,
                            duration,
                            relationships,
                            database: {
                                provider,
                                operation: mapPrismaOperation(operation),
                                table: model,
                                success: true,
                                query: JSON.stringify(args),
                            },
                        });
                        return result;
                    }
                    catch (error) {
                        const duration = Date.now() - start;
                        void collector.collect({
                            category: constants_1.EventCategory.DATABASE,
                            type: "db.query",
                            action: constants_1.EventStatus.FAILED,
                            severity: constants_1.Severity.ERROR,
                            message: `Prisma ${model ? model + "." : ""}${operation} failed: ${error.message || ""}`,
                            duration,
                            relationships,
                            database: {
                                provider,
                                operation: mapPrismaOperation(operation),
                                table: model,
                                success: false,
                                query: JSON.stringify(args),
                            },
                        });
                        throw error;
                    }
                },
            },
        });
    };
}
function mapPrismaOperation(op) {
    const operation = op.toLowerCase();
    if (operation.includes("find") || operation.includes("get"))
        return constants_1.DatabaseOperation.SELECT;
    if (operation.includes("create"))
        return constants_1.DatabaseOperation.INSERT;
    if (operation.includes("update"))
        return constants_1.DatabaseOperation.UPDATE;
    if (operation.includes("delete"))
        return constants_1.DatabaseOperation.DELETE;
    if (operation.includes("upsert"))
        return constants_1.DatabaseOperation.UPSERT;
    return constants_1.DatabaseOperation.SELECT;
}
// ============================================================================
// 2. Mongoose Plugin
// ============================================================================
function mongooseLogSensePlugin(schema, options) {
    const collector = options.collector;
    const preHook = function () {
        this._startTime = Date.now();
    };
    const postHook = function (res, next) {
        const duration = Date.now() - this._startTime;
        const op = this.op || "query";
        const collection = this.model?.modelName || "unknown";
        const activeCtx = context_store_1.contextStore.get();
        const relationships = activeCtx
            ? {
                traceId: activeCtx.traceId,
                requestId: activeCtx.requestId,
                parentEventId: activeCtx.spanId || activeCtx.parentEventId,
                ...(activeCtx.spanId ? { spanId: activeCtx.spanId } : {}),
                ...(activeCtx.sessionId ? { sessionId: activeCtx.sessionId } : {}),
            }
            : undefined;
        void collector.collect({
            category: constants_1.EventCategory.DATABASE,
            type: "db.query",
            action: constants_1.EventStatus.COMPLETED,
            severity: constants_1.Severity.INFO,
            message: `Mongoose ${collection}.${op} succeeded`,
            duration,
            relationships,
            database: {
                provider: constants_1.DatabaseType.MONGODB,
                operation: mapMongooseOperation(op),
                collection,
                success: true,
                query: JSON.stringify(this.getQuery()),
            },
        });
        if (typeof next === "function")
            next();
    };
    const errorHook = function (error, doc, next) {
        const duration = Date.now() - this._startTime;
        const op = this.op || "query";
        const collection = this.model?.modelName || "unknown";
        const activeCtx = context_store_1.contextStore.get();
        const relationships = activeCtx
            ? {
                traceId: activeCtx.traceId,
                requestId: activeCtx.requestId,
                parentEventId: activeCtx.spanId || activeCtx.parentEventId,
                ...(activeCtx.spanId ? { spanId: activeCtx.spanId } : {}),
                ...(activeCtx.sessionId ? { sessionId: activeCtx.sessionId } : {}),
            }
            : undefined;
        void collector.collect({
            category: constants_1.EventCategory.DATABASE,
            type: "db.query",
            action: constants_1.EventStatus.FAILED,
            severity: constants_1.Severity.ERROR,
            message: `Mongoose ${collection}.${op} failed: ${error.message || ""}`,
            duration,
            relationships,
            database: {
                provider: constants_1.DatabaseType.MONGODB,
                operation: mapMongooseOperation(op),
                collection,
                success: false,
                query: JSON.stringify(this.getQuery()),
            },
        });
        next(error);
    };
    const queryHookTypes = [
        "find",
        "findOne",
        "count",
        "countDocuments",
        "estimatedDocumentCount",
        "updateOne",
        "updateMany",
        "deleteOne",
        "deleteMany",
        "findOneAndUpdate",
        "findOneAndDelete",
        "findOneAndReplace",
    ];
    for (const hookType of queryHookTypes) {
        schema.pre(hookType, preHook);
        schema.post(hookType, postHook);
        schema.post(hookType, errorHook);
    }
}
function mapMongooseOperation(op) {
    const operation = op.toLowerCase();
    if (operation.includes("find") || operation.includes("count"))
        return constants_1.DatabaseOperation.SELECT;
    if (operation.includes("update") || operation.includes("replace"))
        return constants_1.DatabaseOperation.UPDATE;
    if (operation.includes("delete") || operation.includes("remove"))
        return constants_1.DatabaseOperation.DELETE;
    if (operation.includes("insert") || operation.includes("save"))
        return constants_1.DatabaseOperation.INSERT;
    return constants_1.DatabaseOperation.SELECT;
}
// ============================================================================
// 3. PostgreSQL Query Wrapper (pg)
// ============================================================================
function wrapPg(pgClientOrPool, collector) {
    if (!pgClientOrPool || typeof pgClientOrPool.query !== "function") {
        return;
    }
    const originalQuery = pgClientOrPool.query;
    pgClientOrPool.query = function (...args) {
        const start = Date.now();
        const queryArg = args[0];
        let queryText = "unknown";
        if (typeof queryArg === "string") {
            queryText = queryArg;
        }
        else if (queryArg && typeof queryArg === "object" && typeof queryArg.text === "string") {
            queryText = queryArg.text;
        }
        const operation = detectSqlOperation(queryText);
        const activeCtx = context_store_1.contextStore.get();
        const relationships = activeCtx
            ? {
                traceId: activeCtx.traceId,
                requestId: activeCtx.requestId,
                parentEventId: activeCtx.spanId || activeCtx.parentEventId,
                ...(activeCtx.spanId ? { spanId: activeCtx.spanId } : {}),
                ...(activeCtx.sessionId ? { sessionId: activeCtx.sessionId } : {}),
            }
            : undefined;
        const recordOutcome = (success, error, rowsAffected) => {
            const duration = Date.now() - start;
            void collector.collect({
                category: constants_1.EventCategory.DATABASE,
                type: "db.query",
                action: success ? constants_1.EventStatus.COMPLETED : constants_1.EventStatus.FAILED,
                severity: success ? constants_1.Severity.INFO : constants_1.Severity.ERROR,
                message: `PG query ${operation} ${success ? "succeeded" : "failed"}`,
                duration,
                relationships,
                database: {
                    provider: constants_1.DatabaseType.POSTGRES,
                    operation,
                    success,
                    query: queryText,
                    rowsAffected,
                },
            });
        };
        // Determine if callback is present (pg supports both promise and callback interfaces)
        const lastArg = args[args.length - 1];
        if (typeof lastArg === "function") {
            const originalCallback = lastArg;
            args[args.length - 1] = function (err, res) {
                if (err) {
                    recordOutcome(false, err);
                }
                else {
                    recordOutcome(true, undefined, res ? res.rowCount : undefined);
                }
                return originalCallback.apply(this, [err, res]);
            };
            return originalQuery.apply(this, args);
        }
        // Return promise wrapper
        const promise = originalQuery.apply(this, args);
        if (promise && typeof promise.then === "function") {
            return promise
                .then((res) => {
                recordOutcome(true, undefined, res ? res.rowCount : undefined);
                return res;
            })
                .catch((err) => {
                recordOutcome(false, err);
                throw err;
            });
        }
        return promise;
    };
}
// ============================================================================
// 4. MySQL2 Connection/Pool Wrapper (mysql2)
// ============================================================================
function wrapMysql2(mysqlConnectionOrPool, collector) {
    if (!mysqlConnectionOrPool || typeof mysqlConnectionOrPool.query !== "function") {
        return;
    }
    const originalQuery = mysqlConnectionOrPool.query;
    mysqlConnectionOrPool.query = function (...args) {
        const start = Date.now();
        const sqlText = typeof args[0] === "string" ? args[0] : (args[0] && args[0].sql) || "unknown";
        const operation = detectSqlOperation(sqlText);
        const activeCtx = context_store_1.contextStore.get();
        const relationships = activeCtx
            ? {
                traceId: activeCtx.traceId,
                requestId: activeCtx.requestId,
                parentEventId: activeCtx.spanId || activeCtx.parentEventId,
                ...(activeCtx.spanId ? { spanId: activeCtx.spanId } : {}),
                ...(activeCtx.sessionId ? { sessionId: activeCtx.sessionId } : {}),
            }
            : undefined;
        const recordOutcome = (success, error, rowsAffected) => {
            const duration = Date.now() - start;
            void collector.collect({
                category: constants_1.EventCategory.DATABASE,
                type: "db.query",
                action: success ? constants_1.EventStatus.COMPLETED : constants_1.EventStatus.FAILED,
                severity: success ? constants_1.Severity.INFO : constants_1.Severity.ERROR,
                message: `MySQL query ${operation} ${success ? "succeeded" : "failed"}`,
                duration,
                relationships,
                database: {
                    provider: constants_1.DatabaseType.MYSQL,
                    operation,
                    success,
                    query: sqlText,
                    rowsAffected,
                },
            });
        };
        // Determine if callback is present (mysql2 query method typically uses callback if promise library is not used)
        const lastArg = args[args.length - 1];
        if (typeof lastArg === "function") {
            const originalCallback = lastArg;
            args[args.length - 1] = function (err, results, fields) {
                if (err) {
                    recordOutcome(false, err);
                }
                else {
                    recordOutcome(true, undefined, results ? results.affectedRows || results.length : undefined);
                }
                return originalCallback.apply(this, [err, results, fields]);
            };
            return originalQuery.apply(this, args);
        }
        // Return promise wrapper (if mysql2/promise client is used)
        const promise = originalQuery.apply(this, args);
        if (promise && typeof promise.then === "function") {
            return promise
                .then((res) => {
                const results = Array.isArray(res) ? res[0] : res;
                recordOutcome(true, undefined, results ? results.affectedRows || results.length : undefined);
                return res;
            })
                .catch((err) => {
                recordOutcome(false, err);
                throw err;
            });
        }
        return promise;
    };
}
function detectSqlOperation(sql) {
    const text = sql.trim().toUpperCase();
    if (text.startsWith("SELECT"))
        return constants_1.DatabaseOperation.SELECT;
    if (text.startsWith("INSERT"))
        return constants_1.DatabaseOperation.INSERT;
    if (text.startsWith("UPDATE"))
        return constants_1.DatabaseOperation.UPDATE;
    if (text.startsWith("DELETE"))
        return constants_1.DatabaseOperation.DELETE;
    if (text.startsWith("CREATE"))
        return constants_1.DatabaseOperation.CREATE;
    if (text.startsWith("DROP"))
        return constants_1.DatabaseOperation.DROP;
    if (text.startsWith("ALTER"))
        return constants_1.DatabaseOperation.ALTER;
    return constants_1.DatabaseOperation.SELECT;
}
//# sourceMappingURL=db-instrumentation.js.map