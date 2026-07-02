"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.metricsCollector = exports.MetricsCollector = void 0;
class MetricsCollector {
    eventsProcessed = 0;
    eventsDropped = 0;
    retryCount = 0;
    transportLatencySum = 0;
    transportLatencyCount = 0;
    transportSuccesses = 0;
    transportFailures = 0;
    flushCount = 0;
    batchSizeSum = 0;
    batchSizeCount = 0;
    // Rate calculations
    lastRateCalcTime = Date.now();
    eventsSinceLastCalc = 0;
    currentEventsPerSecond = 0;
    recordEventProcessed(count = 1) {
        this.eventsProcessed += count;
        this.eventsSinceLastCalc += count;
        this.calculateRate();
    }
    recordEventDropped(count = 1) {
        this.eventsDropped += count;
    }
    recordRetry(count = 1) {
        this.retryCount += count;
    }
    recordTransportLatency(durationMs) {
        this.transportLatencySum += durationMs;
        this.transportLatencyCount++;
    }
    recordTransportSuccess() {
        this.transportSuccesses++;
    }
    recordTransportFailure() {
        this.transportFailures++;
    }
    recordFlush(batchSize) {
        this.flushCount++;
        this.batchSizeSum += batchSize;
        this.batchSizeCount++;
    }
    getEventsProcessed() {
        return this.eventsProcessed;
    }
    getEventsDropped() {
        return this.eventsDropped;
    }
    getRetryCount() {
        return this.retryCount;
    }
    getAverageTransportLatency() {
        if (this.transportLatencyCount === 0) {
            return 0;
        }
        return this.transportLatencySum / this.transportLatencyCount;
    }
    getTransportSuccessCount() {
        return this.transportSuccesses;
    }
    getTransportFailureCount() {
        return this.transportFailures;
    }
    getEventsPerSecond() {
        this.calculateRate();
        return this.currentEventsPerSecond;
    }
    getFlushCount() {
        return this.flushCount;
    }
    getAverageBatchSize() {
        if (this.batchSizeCount === 0) {
            return 0;
        }
        return this.batchSizeSum / this.batchSizeCount;
    }
    reset() {
        this.eventsProcessed = 0;
        this.eventsDropped = 0;
        this.retryCount = 0;
        this.transportLatencySum = 0;
        this.transportLatencyCount = 0;
        this.transportSuccesses = 0;
        this.transportFailures = 0;
        this.flushCount = 0;
        this.batchSizeSum = 0;
        this.batchSizeCount = 0;
        this.eventsSinceLastCalc = 0;
        this.currentEventsPerSecond = 0;
        this.lastRateCalcTime = Date.now();
    }
    calculateRate() {
        const now = Date.now();
        const elapsedSeconds = (now - this.lastRateCalcTime) / 1000;
        if (elapsedSeconds >= 1.0) {
            this.currentEventsPerSecond = this.eventsSinceLastCalc / elapsedSeconds;
            this.eventsSinceLastCalc = 0;
            this.lastRateCalcTime = now;
        }
    }
}
exports.MetricsCollector = MetricsCollector;
exports.metricsCollector = new MetricsCollector();
//# sourceMappingURL=metrics.js.map