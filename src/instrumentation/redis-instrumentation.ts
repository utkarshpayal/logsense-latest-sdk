import { EventCategory, EventStatus, Severity } from "../event/constants";
import { Collector } from "../collector/collector";
import { contextStore } from "../context/context-store";

export function wrapRedisClient(redisClient: any, collector: Collector): void {
    if (!redisClient) {
        return;
    }

    const recordCacheEvent = (operation: string, key: string, success: boolean, duration: number, hit?: boolean, error?: Error) => {
        const activeCtx = contextStore.get();
        const relationships: any = activeCtx
            ? {
                  traceId: activeCtx.traceId,
                  requestId: activeCtx.requestId,
                  ...(activeCtx.spanId ? { spanId: activeCtx.spanId } : {}),
                  ...(activeCtx.sessionId ? { sessionId: activeCtx.sessionId } : {}),
              }
            : undefined;

        void collector.collect<any>({
            category: EventCategory.CACHE,
            type: "cache.operation",
            action: success ? EventStatus.SUCCESS : EventStatus.FAILED,
            severity: success ? Severity.INFO : Severity.ERROR,
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
        redisClient.get = function (this: any, ...args: any[]) {
            const start = Date.now();
            const key = String(args[0] || "");

            const handleResult = (err: any, res: any) => {
                const duration = Date.now() - start;
                if (err) {
                    recordCacheEvent("get", key, false, duration, undefined, err);
                } else {
                    const hit = res !== null && res !== undefined;
                    recordCacheEvent("get", key, true, duration, hit);
                }
            };

            const lastArg = args[args.length - 1];
            if (typeof lastArg === "function") {
                const originalCallback = lastArg;
                args[args.length - 1] = function (err: any, res: any) {
                    handleResult(err, res);
                    return originalCallback.apply(this, [err, res]);
                };
                return originalGet.apply(this, args);
            }

            const promise = originalGet.apply(this, args);
            if (promise && typeof promise.then === "function") {
                return promise
                    .then((res: any) => {
                        handleResult(null, res);
                        return res;
                    })
                    .catch((err: any) => {
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
        redisClient.set = function (this: any, ...args: any[]) {
            const start = Date.now();
            const key = String(args[0] || "");

            const handleResult = (err: any) => {
                const duration = Date.now() - start;
                recordCacheEvent("set", key, !err, duration, undefined, err || undefined);
            };

            const lastArg = args[args.length - 1];
            if (typeof lastArg === "function") {
                const originalCallback = lastArg;
                args[args.length - 1] = function (err: any, res: any) {
                    handleResult(err);
                    return originalCallback.apply(this, [err, res]);
                };
                return originalSet.apply(this, args);
            }

            const promise = originalSet.apply(this, args);
            if (promise && typeof promise.then === "function") {
                return promise
                    .then((res: any) => {
                        handleResult(null);
                        return res;
                    })
                    .catch((err: any) => {
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
            redisClient[method] = function (this: any, ...args: any[]) {
                const start = Date.now();
                const key = String(args[0] || "");

                const handleResult = (err: any) => {
                    const duration = Date.now() - start;
                    recordCacheEvent("del", key, !err, duration, undefined, err || undefined);
                };

                const lastArg = args[args.length - 1];
                if (typeof lastArg === "function") {
                    const originalCallback = lastArg;
                    args[args.length - 1] = function (err: any, res: any) {
                        handleResult(err);
                        return originalCallback.apply(this, [err, res]);
                    };
                    return originalDel.apply(this, args);
                }

                const promise = originalDel.apply(this, args);
                if (promise && typeof promise.then === "function") {
                    return promise
                        .then((res: any) => {
                            handleResult(null);
                            return res;
                        })
                        .catch((err: any) => {
                            handleResult(err);
                            throw err;
                        });
                }

                return promise;
            };
        }
    }
}
