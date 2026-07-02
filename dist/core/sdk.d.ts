import { buildConfig, SDKConfig } from "./config";
import { Collector } from "../collector/collector";
import { EventBuilder } from "../event/builder";
import { EventQueue } from "../queue/queue";
import { HttpTransport } from "../transport/http-transport";
import { BatchManager } from "../batch/batch-manager";
import { RetryManager } from "../retry/retry-manager";
import { DeadLetterQueue } from "../retry/dlq";
import { LogSenseLogger } from "../logger/logger";
import { HealthMonitor } from "../monitoring/health";
import { Session } from "../session";
import { LogSensePlugin } from "../pipeline/plugin";
import { EventProcessor } from "../pipeline/processor";
export declare class LogSenseClient {
    readonly config: ReturnType<typeof buildConfig>;
    readonly queue: EventQueue;
    readonly transport: HttpTransport;
    readonly retryManager: RetryManager;
    readonly dlq: DeadLetterQueue;
    readonly batchManager: BatchManager;
    readonly builder: EventBuilder;
    readonly collector: Collector;
    readonly logger: LogSenseLogger;
    readonly healthMonitor: HealthMonitor;
    private readonly exceptionCapture;
    private readonly runtimeMonitor;
    private readonly httpClientInstrumentation;
    private readonly httpServerInstrumentation;
    private isShutDown;
    constructor(userConfig?: SDKConfig);
    /**
     * Register a lifecycle plugin or custom processor.
     */
    use(plugin: LogSensePlugin | EventProcessor): this;
    /**
     * Gracefully shutdown the SDK: stop timers, flush queue, retry remaining, close transport.
     */
    shutdown(): Promise<void>;
}
export declare const logsense: {
    init(config?: SDKConfig): LogSenseClient;
    shutdown(): Promise<void>;
    track(partialEvent: any): Promise<any>;
    captureException(error: Error | unknown): Promise<any>;
    trace<T>(name: string, fn: (span: any) => T | Promise<T>): T | Promise<T>;
    startSpan(name: string, options?: any): any;
    readonly logger: LogSenseLogger;
    readonly client: LogSenseClient | null;
    identify(userId: string, userMetadata?: Record<string, any>): void;
    setUser(user: {
        id: string;
        email?: string;
        name?: string;
        role?: string;
        metadata?: Record<string, any>;
    }): void;
    setOrganization(orgId: string): void;
    setWorkspace(workspaceId: string): void;
    clearIdentity(): void;
    resetIdentity(): void;
    currentSession(): Session | undefined;
    trackBusinessEvent(name: string, metadata?: Record<string, any>): Promise<any>;
    business: {
        orderCreated(orderId: string, amount: number, currency: string, metadata?: Record<string, any>): Promise<any>;
        paymentSucceeded(paymentId: string, amount: number, currency: string, metadata?: Record<string, any>): Promise<any>;
        userRegistered(userId: string, email: string, metadata?: Record<string, any>): Promise<any>;
        subscriptionRenewed(subscriptionId: string, plan: string, amount: number, metadata?: Record<string, any>): Promise<any>;
    };
    metrics(): Record<string, any> | null;
    health(): any | null;
    use(plugin: LogSensePlugin | EventProcessor): void;
};
//# sourceMappingURL=sdk.d.ts.map