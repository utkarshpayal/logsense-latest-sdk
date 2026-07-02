import { Event } from "../event/types";
import { EventTransport } from "../transport/transport";
import { BackoffStrategy } from "./backoff";
import { DeadLetterQueue } from "./dlq";
import { LogSensePlugin } from "../pipeline/plugin";
export interface RetryManagerOptions {
    transport: EventTransport;
    backoffStrategy: BackoffStrategy;
    dlq: DeadLetterQueue;
    maxAttempts?: number;
    debug?: boolean;
    plugins?: LogSensePlugin[];
}
export declare class RetryManager {
    private readonly transport;
    private readonly backoffStrategy;
    private readonly dlq;
    private readonly maxAttempts;
    private readonly debug;
    private readonly plugins;
    private readonly pendingTimers;
    private readonly pendingEvents;
    private retryCount;
    private activeRetryAttempts;
    private retryQueueSize;
    constructor(options: RetryManagerOptions);
    /**
     * Determine if an HTTP status code or error is retryable.
     */
    isRetryable(statusCode?: number, error?: Error): boolean;
    /**
     * Schedule a batch of events for retry.
     */
    schedule(events: Event[], statusCode?: number, error?: Error): Promise<void>;
    /**
     * Get the number of events currently waiting for retry.
     */
    getRetryQueueSize(): number;
    /**
     * Get the total number of retry attempts made.
     */
    getRetryCount(): number;
    /**
     * Internal recursive retry function.
     */
    private retry;
    /**
     * Gracefully shutdown the retry manager: cancels all timers.
     * Any scheduled events that were not sent are stored in the DLQ.
     */
    shutdown(): Promise<Event[]>;
}
//# sourceMappingURL=retry-manager.d.ts.map