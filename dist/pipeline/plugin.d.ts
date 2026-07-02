import { Event, PartialEvent } from "../event/types";
export interface LogSensePlugin {
    name: string;
    beforeBuild?(partial: PartialEvent<any>): Promise<PartialEvent<any> | null | void> | PartialEvent<any> | null | void;
    afterBuild?(event: Event): Promise<Event | null | void> | Event | null | void;
    beforeQueue?(event: Event): Promise<Event | null | void> | Event | null | void;
    afterQueue?(event: Event): Promise<void> | void;
    beforeTransport?(batch: Event[]): Promise<Event[] | null | void> | Event[] | null | void;
    afterTransport?(batch: Event[], result: any): Promise<void> | void;
    onRetry?(batch: Event[], attempt: number, delayMs: number): Promise<void> | void;
    onError?(error: Error, context?: any): Promise<void> | void;
    onShutdown?(): Promise<void> | void;
}
//# sourceMappingURL=plugin.d.ts.map