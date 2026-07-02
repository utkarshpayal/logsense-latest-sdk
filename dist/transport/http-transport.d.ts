import { Event } from "../event/types";
import { EventTransport, SendBatchResult } from "./transport";
export interface HttpTransportOptions {
    endpoint: string;
    apiKey: string;
    timeout?: number;
}
export declare class HttpTransport implements EventTransport {
    private readonly endpoint;
    private readonly apiKey;
    private readonly timeout;
    constructor(options: HttpTransportOptions);
    sendBatch(events: Event[]): Promise<SendBatchResult>;
    close(): Promise<void>;
}
//# sourceMappingURL=http-transport.d.ts.map