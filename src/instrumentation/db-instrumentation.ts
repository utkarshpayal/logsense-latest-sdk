import { DatabaseOperation, DatabaseType, EventCategory, EventStatus, Severity } from "../event/constants";
import { Collector } from "../collector/collector";
import { contextStore } from "../context/context-store";

// ============================================================================
// 1. Prisma Client Extension
// ============================================================================

export function prismaLogSenseExtension(collector: Collector, provider: DatabaseType = DatabaseType.POSTGRES) {
    return (client: any) => {
        return client.$extends({
            name: "logsense-prisma",
            query: {
                async $allOperations({ model, operation, args, query }: any) {
                    const start = Date.now();
                    const activeCtx = contextStore.get();
                    const relationships: any = activeCtx
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

                        void collector.collect<any>({
                            category: EventCategory.DATABASE,
                            type: "db.query",
                            action: EventStatus.COMPLETED,
                            severity: Severity.INFO,
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
                    } catch (error: any) {
                        const duration = Date.now() - start;

                        void collector.collect<any>({
                            category: EventCategory.DATABASE,
                            type: "db.query",
                            action: EventStatus.FAILED,
                            severity: Severity.ERROR,
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

function mapPrismaOperation(op: string): DatabaseOperation {
    const operation = op.toLowerCase();
    if (operation.includes("find") || operation.includes("get")) return DatabaseOperation.SELECT;
    if (operation.includes("create")) return DatabaseOperation.INSERT;
    if (operation.includes("update")) return DatabaseOperation.UPDATE;
    if (operation.includes("delete")) return DatabaseOperation.DELETE;
    if (operation.includes("upsert")) return DatabaseOperation.UPSERT;
    return DatabaseOperation.SELECT;
}

// ============================================================================
// 2. Mongoose Plugin
// ============================================================================

export function mongooseLogSensePlugin(schema: any, options: { collector: Collector }) {
    const collector = options.collector;

    const preHook = function (this: any) {
        this._startTime = Date.now();
    };

    const postHook = function (this: any, res: any, next?: any) {
        const duration = Date.now() - this._startTime;
        const op = this.op || "query";
        const collection = this.model?.modelName || "unknown";

        const activeCtx = contextStore.get();
        const relationships: any = activeCtx
            ? {
                  traceId: activeCtx.traceId,
                  requestId: activeCtx.requestId,
                  parentEventId: activeCtx.spanId || activeCtx.parentEventId,
                  ...(activeCtx.spanId ? { spanId: activeCtx.spanId } : {}),
                  ...(activeCtx.sessionId ? { sessionId: activeCtx.sessionId } : {}),
              }
            : undefined;

        void collector.collect<any>({
            category: EventCategory.DATABASE,
            type: "db.query",
            action: EventStatus.COMPLETED,
            severity: Severity.INFO,
            message: `Mongoose ${collection}.${op} succeeded`,
            duration,
            relationships,
            database: {
                provider: DatabaseType.MONGODB,
                operation: mapMongooseOperation(op),
                collection,
                success: true,
                query: JSON.stringify(this.getQuery()),
            },
        });

        if (typeof next === "function") next();
    };

    const errorHook = function (this: any, error: any, doc: any, next: any) {
        const duration = Date.now() - this._startTime;
        const op = this.op || "query";
        const collection = this.model?.modelName || "unknown";

        const activeCtx = contextStore.get();
        const relationships: any = activeCtx
            ? {
                  traceId: activeCtx.traceId,
                  requestId: activeCtx.requestId,
                  parentEventId: activeCtx.spanId || activeCtx.parentEventId,
                  ...(activeCtx.spanId ? { spanId: activeCtx.spanId } : {}),
                  ...(activeCtx.sessionId ? { sessionId: activeCtx.sessionId } : {}),
              }
            : undefined;

        void collector.collect<any>({
            category: EventCategory.DATABASE,
            type: "db.query",
            action: EventStatus.FAILED,
            severity: Severity.ERROR,
            message: `Mongoose ${collection}.${op} failed: ${error.message || ""}`,
            duration,
            relationships,
            database: {
                provider: DatabaseType.MONGODB,
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

function mapMongooseOperation(op: string): DatabaseOperation {
    const operation = op.toLowerCase();
    if (operation.includes("find") || operation.includes("count")) return DatabaseOperation.SELECT;
    if (operation.includes("update") || operation.includes("replace")) return DatabaseOperation.UPDATE;
    if (operation.includes("delete") || operation.includes("remove")) return DatabaseOperation.DELETE;
    if (operation.includes("insert") || operation.includes("save")) return DatabaseOperation.INSERT;
    return DatabaseOperation.SELECT;
}

// ============================================================================
// 3. PostgreSQL Query Wrapper (pg)
// ============================================================================

export function wrapPg(pgClientOrPool: any, collector: Collector): void {
    if (!pgClientOrPool || typeof pgClientOrPool.query !== "function") {
        return;
    }

    const originalQuery = pgClientOrPool.query;

    pgClientOrPool.query = function (this: any, ...args: any[]) {
        const start = Date.now();
        const queryArg = args[0];

        let queryText = "unknown";
        if (typeof queryArg === "string") {
            queryText = queryArg;
        } else if (queryArg && typeof queryArg === "object" && typeof queryArg.text === "string") {
            queryText = queryArg.text;
        }

        const operation = detectSqlOperation(queryText);
        const activeCtx = contextStore.get();
        const relationships: any = activeCtx
            ? {
                  traceId: activeCtx.traceId,
                  requestId: activeCtx.requestId,
                  parentEventId: activeCtx.spanId || activeCtx.parentEventId,
                  ...(activeCtx.spanId ? { spanId: activeCtx.spanId } : {}),
                  ...(activeCtx.sessionId ? { sessionId: activeCtx.sessionId } : {}),
              }
            : undefined;

        const recordOutcome = (success: boolean, error?: Error, rowsAffected?: number) => {
            const duration = Date.now() - start;
            void collector.collect<any>({
                category: EventCategory.DATABASE,
                type: "db.query",
                action: success ? EventStatus.COMPLETED : EventStatus.FAILED,
                severity: success ? Severity.INFO : Severity.ERROR,
                message: `PG query ${operation} ${success ? "succeeded" : "failed"}`,
                duration,
                relationships,
                database: {
                    provider: DatabaseType.POSTGRES,
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
            args[args.length - 1] = function (err: any, res: any) {
                if (err) {
                    recordOutcome(false, err);
                } else {
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
                .then((res: any) => {
                    recordOutcome(true, undefined, res ? res.rowCount : undefined);
                    return res;
                })
                .catch((err: any) => {
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

export function wrapMysql2(mysqlConnectionOrPool: any, collector: Collector): void {
    if (!mysqlConnectionOrPool || typeof mysqlConnectionOrPool.query !== "function") {
        return;
    }

    const originalQuery = mysqlConnectionOrPool.query;

    mysqlConnectionOrPool.query = function (this: any, ...args: any[]) {
        const start = Date.now();
        const sqlText = typeof args[0] === "string" ? args[0] : (args[0] && args[0].sql) || "unknown";

        const operation = detectSqlOperation(sqlText);
        const activeCtx = contextStore.get();
        const relationships: any = activeCtx
            ? {
                  traceId: activeCtx.traceId,
                  requestId: activeCtx.requestId,
                  parentEventId: activeCtx.spanId || activeCtx.parentEventId,
                  ...(activeCtx.spanId ? { spanId: activeCtx.spanId } : {}),
                  ...(activeCtx.sessionId ? { sessionId: activeCtx.sessionId } : {}),
              }
            : undefined;

        const recordOutcome = (success: boolean, error?: Error, rowsAffected?: number) => {
            const duration = Date.now() - start;
            void collector.collect<any>({
                category: EventCategory.DATABASE,
                type: "db.query",
                action: success ? EventStatus.COMPLETED : EventStatus.FAILED,
                severity: success ? Severity.INFO : Severity.ERROR,
                message: `MySQL query ${operation} ${success ? "succeeded" : "failed"}`,
                duration,
                relationships,
                database: {
                    provider: DatabaseType.MYSQL,
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
            args[args.length - 1] = function (err: any, results: any, fields: any) {
                if (err) {
                    recordOutcome(false, err);
                } else {
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
                .then((res: any) => {
                    const results = Array.isArray(res) ? res[0] : res;
                    recordOutcome(true, undefined, results ? results.affectedRows || results.length : undefined);
                    return res;
                })
                .catch((err: any) => {
                    recordOutcome(false, err);
                    throw err;
                });
        }

        return promise;
    };
}

function detectSqlOperation(sql: string): DatabaseOperation {
    const text = sql.trim().toUpperCase();
    if (text.startsWith("SELECT")) return DatabaseOperation.SELECT;
    if (text.startsWith("INSERT")) return DatabaseOperation.INSERT;
    if (text.startsWith("UPDATE")) return DatabaseOperation.UPDATE;
    if (text.startsWith("DELETE")) return DatabaseOperation.DELETE;
    if (text.startsWith("CREATE")) return DatabaseOperation.CREATE;
    if (text.startsWith("DROP")) return DatabaseOperation.DROP;
    if (text.startsWith("ALTER")) return DatabaseOperation.ALTER;
    return DatabaseOperation.SELECT;
}
