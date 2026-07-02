export declare class MetricsCollector {
    private eventsProcessed;
    private eventsDropped;
    private retryCount;
    private transportLatencySum;
    private transportLatencyCount;
    private transportSuccesses;
    private transportFailures;
    private flushCount;
    private batchSizeSum;
    private batchSizeCount;
    private lastRateCalcTime;
    private eventsSinceLastCalc;
    private currentEventsPerSecond;
    recordEventProcessed(count?: number): void;
    recordEventDropped(count?: number): void;
    recordRetry(count?: number): void;
    recordTransportLatency(durationMs: number): void;
    recordTransportSuccess(): void;
    recordTransportFailure(): void;
    recordFlush(batchSize: number): void;
    getEventsProcessed(): number;
    getEventsDropped(): number;
    getRetryCount(): number;
    getAverageTransportLatency(): number;
    getTransportSuccessCount(): number;
    getTransportFailureCount(): number;
    getEventsPerSecond(): number;
    getFlushCount(): number;
    getAverageBatchSize(): number;
    reset(): void;
    private calculateRate;
}
export declare const metricsCollector: MetricsCollector;
//# sourceMappingURL=metrics.d.ts.map