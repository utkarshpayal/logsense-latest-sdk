export interface BackoffStrategy {
    getDelay(attempt: number): number;
}

export class FixedBackoff implements BackoffStrategy {
    constructor(
        private readonly baseDelayMs: number,
        private readonly maxDelayMs: number,
    ) {}

    getDelay(_attempt: number): number {
        return Math.min(this.baseDelayMs, this.maxDelayMs);
    }
}

export class LinearBackoff implements BackoffStrategy {
    constructor(
        private readonly baseDelayMs: number,
        private readonly maxDelayMs: number,
    ) {}

    getDelay(attempt: number): number {
        return Math.min(this.baseDelayMs * attempt, this.maxDelayMs);
    }
}

export class ExponentialBackoff implements BackoffStrategy {
    constructor(
        private readonly baseDelayMs: number,
        private readonly maxDelayMs: number,
    ) {}

    getDelay(attempt: number): number {
        const delay = this.baseDelayMs * Math.pow(2, Math.max(0, attempt - 1));
        return Math.min(delay, this.maxDelayMs);
    }
}

export class JitteredExponentialBackoff implements BackoffStrategy {
    constructor(
        private readonly baseDelayMs: number,
        private readonly maxDelayMs: number,
    ) {}

    getDelay(attempt: number): number {
        const delay = this.baseDelayMs * Math.pow(2, Math.max(0, attempt - 1));
        // Full jitter formula: random between 0 and delay, then capped at maxDelayMs
        const jittered = Math.random() * delay;
        return Math.min(jittered, this.maxDelayMs);
    }
}

export function createBackoffStrategy(
    type: "fixed" | "linear" | "exponential" | "jitter",
    baseDelayMs: number,
    maxDelayMs: number,
): BackoffStrategy {
    switch (type) {
        case "fixed":
            return new FixedBackoff(baseDelayMs, maxDelayMs);
        case "linear":
            return new LinearBackoff(baseDelayMs, maxDelayMs);
        case "exponential":
            return new ExponentialBackoff(baseDelayMs, maxDelayMs);
        case "jitter":
            return new JitteredExponentialBackoff(baseDelayMs, maxDelayMs);
    }
}
