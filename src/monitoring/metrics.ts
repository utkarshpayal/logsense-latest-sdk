export class MetricsCollector {
    private eventsProcessed = 0;
    private eventsDropped = 0;
    private retryCount = 0;
    private transportLatencySum = 0;
    private transportLatencyCount = 0;
    private transportSuccesses = 0;
    private transportFailures = 0;
    private flushCount = 0;
    private batchSizeSum = 0;
    private batchSizeCount = 0;

    // Rate calculations
    private lastRateCalcTime = Date.now();
    private eventsSinceLastCalc = 0;
    private currentEventsPerSecond = 0;

    recordEventProcessed(count = 1): void {
        this.eventsProcessed += count;
        this.eventsSinceLastCalc += count;
        this.calculateRate();
    }

    recordEventDropped(count = 1): void {
        this.eventsDropped += count;
    }

    recordRetry(count = 1): void {
        this.retryCount += count;
    }

    recordTransportLatency(durationMs: number): void {
        this.transportLatencySum += durationMs;
        this.transportLatencyCount++;
    }

    recordTransportSuccess(): void {
        this.transportSuccesses++;
    }

    recordTransportFailure(): void {
        this.transportFailures++;
    }

    recordFlush(batchSize: number): void {
        this.flushCount++;
        this.batchSizeSum += batchSize;
        this.batchSizeCount++;
    }

    getEventsProcessed(): number {
        return this.eventsProcessed;
    }

    getEventsDropped(): number {
        return this.eventsDropped;
    }

    getRetryCount(): number {
        return this.retryCount;
    }

    getAverageTransportLatency(): number {
        if (this.transportLatencyCount === 0) {
            return 0;
        }
        return this.transportLatencySum / this.transportLatencyCount;
    }

    getTransportSuccessCount(): number {
        return this.transportSuccesses;
    }

    getTransportFailureCount(): number {
        return this.transportFailures;
    }

    getEventsPerSecond(): number {
        this.calculateRate();
        return this.currentEventsPerSecond;
    }

    getFlushCount(): number {
        return this.flushCount;
    }

    getAverageBatchSize(): number {
        if (this.batchSizeCount === 0) {
            return 0;
        }
        return this.batchSizeSum / this.batchSizeCount;
    }

    reset(): void {
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

    private calculateRate(): void {
        const now = Date.now();
        const elapsedSeconds = (now - this.lastRateCalcTime) / 1000;

        if (elapsedSeconds >= 1.0) {
            this.currentEventsPerSecond = this.eventsSinceLastCalc / elapsedSeconds;
            this.eventsSinceLastCalc = 0;
            this.lastRateCalcTime = now;
        }
    }
}

export const metricsCollector = new MetricsCollector();
