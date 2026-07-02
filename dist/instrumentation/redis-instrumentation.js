"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.wrapRedisClient = wrapRedisClient;
const constants_1 = require("../event/constants");
const context_store_1 = require("../context/context-store");
function wrapRedisClient(redisClient, collector) {
    if (!redisClient) {
        return;
    }
    const recordCacheEvent = (operation, key, success, duration, hit, error) => {
        const activeCtx = context_store_1.contextStore.get();
        const relationships = activeCtx
            ? {
                traceId: activeCtx.traceId,
                requestId: activeCtx.requestId,
                ...(activeCtx.spanId ? { spanId: activeCtx.spanId } : {}),
                ...(activeCtx.sessionId ? { sessionId: activeCtx.sessionId } : {}),
            }
            : undefined;
        void collector.collect({
            category: constants_1.EventCategory.CACHE,
            type: "cache.operation",
            action: success ? constants_1.EventStatus.SUCCESS : constants_1.EventStatus.FAILED,
            severity: success ? constants_1.Severity.INFO : constants_1.Severity.ERROR,
            message: `Redis ${operation.toUpperCase()} on "${key}" - ${success ? (hit !== undefined ? (hit ? "HIT" : "MISS") : "Success") : "Failed"}`,
            duration,
            relationships,
            cache: {
                provider: "redis",
                operation: operation.toUpperCase(),
                key,
                hit,
                success,
            },
            metadata: error
                ? {
                    errorName: error.name,
                    errorMessage: error.message,
                }
                : undefined,
        });
    };
    // 1. Wrap GET
    if (typeof redisClient.get === "function") {
        const originalGet = redisClient.get;
        redisClient.get = function (...args) {
            const start = Date.now();
            const key = String(args[0] || "");
            const handleResult = (err, res) => {
                const duration = Date.now() - start;
                if (err) {
                    recordCacheEvent("get", key, false, duration, undefined, err);
                }
                else {
                    const hit = res !== null && res !== undefined;
                    recordCacheEvent("get", key, true, duration, hit);
                }
            };
            const lastArg = args[args.length - 1];
            if (typeof lastArg === "function") {
                const originalCallback = lastArg;
                args[args.length - 1] = function (err, res) {
                    handleResult(err, res);
                    return originalCallback.apply(this, [err, res]);
                };
                return originalGet.apply(this, args);
            }
            const promise = originalGet.apply(this, args);
            if (promise && typeof promise.then === "function") {
                return promise
                    .then((res) => {
                    handleResult(null, res);
                    return res;
                })
                    .catch((err) => {
                    handleResult(err, null);
                    throw err;
                });
            }
            return promise;
        };
    }
    // 2. Wrap SET
    if (typeof redisClient.set === "function") {
        const originalSet = redisClient.set;
        redisClient.set = function (...args) {
            const start = Date.now();
            const key = String(args[0] || "");
            const handleResult = (err) => {
                const duration = Date.now() - start;
                recordCacheEvent("set", key, !err, duration, undefined, err || undefined);
            };
            const lastArg = args[args.length - 1];
            if (typeof lastArg === "function") {
                const originalCallback = lastArg;
                args[args.length - 1] = function (err, res) {
                    handleResult(err);
                    return originalCallback.apply(this, [err, res]);
                };
                return originalSet.apply(this, args);
            }
            const promise = originalSet.apply(this, args);
            if (promise && typeof promise.then === "function") {
                return promise
                    .then((res) => {
                    handleResult(null);
                    return res;
                })
                    .catch((err) => {
                    handleResult(err);
                    throw err;
                });
            }
            return promise;
        };
    }
    // 3. Wrap DEL
    const delMethods = ["del", "delete"];
    for (const method of delMethods) {
        if (typeof redisClient[method] === "function") {
            const originalDel = redisClient[method];
            redisClient[method] = function (...args) {
                const start = Date.now();
                const key = String(args[0] || "");
                const handleResult = (err) => {
                    const duration = Date.now() - start;
                    recordCacheEvent("del", key, !err, duration, undefined, err || undefined);
                };
                const lastArg = args[args.length - 1];
                if (typeof lastArg === "function") {
                    const originalCallback = lastArg;
                    args[args.length - 1] = function (err, res) {
                        handleResult(err);
                        return originalCallback.apply(this, [err, res]);
                    };
                    return originalDel.apply(this, args);
                }
                const promise = originalDel.apply(this, args);
                if (promise && typeof promise.then === "function") {
                    return promise
                        .then((res) => {
                        handleResult(null);
                        return res;
                    })
                        .catch((err) => {
                        handleResult(err);
                        throw err;
                    });
                }
                return promise;
            };
        }
    }
}
//# sourceMappingURL=redis-instrumentation.js.map