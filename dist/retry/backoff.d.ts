export interface BackoffStrategy {
    getDelay(attempt: number): number;
}
export declare class FixedBackoff implements BackoffStrategy {
    private readonly baseDelayMs;
    private readonly maxDelayMs;
    constructor(baseDelayMs: number, maxDelayMs: number);
    getDelay(_attempt: number): number;
}
export declare class LinearBackoff implements BackoffStrategy {
    private readonly baseDelayMs;
    private readonly maxDelayMs;
    constructor(baseDelayMs: number, maxDelayMs: number);
    getDelay(attempt: number): number;
}
export declare class ExponentialBackoff implements BackoffStrategy {
    private readonly baseDelayMs;
    private readonly maxDelayMs;
    constructor(baseDelayMs: number, maxDelayMs: number);
    getDelay(attempt: number): number;
}
export declare class JitteredExponentialBackoff implements BackoffStrategy {
    private readonly baseDelayMs;
    private readonly maxDelayMs;
    constructor(baseDelayMs: number, maxDelayMs: number);
    getDelay(attempt: number): number;
}
export declare function createBackoffStrategy(type: "fixed" | "linear" | "exponential" | "jitter", baseDelayMs: number, maxDelayMs: number): BackoffStrategy;
//# sourceMappingURL=backoff.d.ts.map