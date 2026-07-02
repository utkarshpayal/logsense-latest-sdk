import { Event } from "../event/types";
export interface SendBatchResult {
    success: boolean;
    accepted: number;
    failed: number;
    statusCode?: number;
    error?: Error;
}
export interface EventTransport {
    /**
     * Sends a batch of events.
     */
    sendBatch(events: Event[]): Promise<SendBatchResult>;
    /**
     * Gracefully shutdown transport.
     */
    close?(): Promise<void>;
}
//# sourceMappingURL=transport.d.ts.map