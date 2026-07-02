"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JitteredExponentialBackoff = exports.ExponentialBackoff = exports.LinearBackoff = exports.FixedBackoff = void 0;
exports.createBackoffStrategy = createBackoffStrategy;
class FixedBackoff {
    baseDelayMs;
    maxDelayMs;
    constructor(baseDelayMs, maxDelayMs) {
        this.baseDelayMs = baseDelayMs;
        this.maxDelayMs = maxDelayMs;
    }
    getDelay(_attempt) {
        return Math.min(this.baseDelayMs, this.maxDelayMs);
    }
}
exports.FixedBackoff = FixedBackoff;
class LinearBackoff {
    baseDelayMs;
    maxDelayMs;
    constructor(baseDelayMs, maxDelayMs) {
        this.baseDelayMs = baseDelayMs;
        this.maxDelayMs = maxDelayMs;
    }
    getDelay(attempt) {
        return Math.min(this.baseDelayMs * attempt, this.maxDelayMs);
    }
}
exports.LinearBackoff = LinearBackoff;
class ExponentialBackoff {
    baseDelayMs;
    maxDelayMs;
    constructor(baseDelayMs, maxDelayMs) {
        this.baseDelayMs = baseDelayMs;
        this.maxDelayMs = maxDelayMs;
    }
    getDelay(attempt) {
        const delay = this.baseDelayMs * Math.pow(2, Math.max(0, attempt - 1));
        return Math.min(delay, this.maxDelayMs);
    }
}
exports.ExponentialBackoff = ExponentialBackoff;
class JitteredExponentialBackoff {
    baseDelayMs;
    maxDelayMs;
    constructor(baseDelayMs, maxDelayMs) {
        this.baseDelayMs = baseDelayMs;
        this.maxDelayMs = maxDelayMs;
    }
    getDelay(attempt) {
        const delay = this.baseDelayMs * Math.pow(2, Math.max(0, attempt - 1));
        // Full jitter formula: random between 0 and delay, then capped at maxDelayMs
        const jittered = Math.random() * delay;
        return Math.min(jittered, this.maxDelayMs);
    }
}
exports.JitteredExponentialBackoff = JitteredExponentialBackoff;
function createBackoffStrategy(type, baseDelayMs, maxDelayMs) {
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
//# sourceMappingURL=backoff.js.map