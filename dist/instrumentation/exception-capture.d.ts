import { Collector } from "../collector/collector";
export interface ExceptionCaptureOptions {
    collector: Collector;
    onShutdown: () => Promise<void>;
    debug?: boolean;
}
export declare class ExceptionCapture {
    private readonly collector;
    private readonly onShutdown;
    private readonly debug;
    private isRegistered;
    private originalUncaughtHandler;
    constructor(options: ExceptionCaptureOptions);
    /**
     * Start intercepting uncaughtExceptions and unhandledRejections.
     */
    register(): void;
    /**
     * Stop intercepting.
     */
    unregister(): void;
    private handleUncaughtException;
    private handleUnhandledRejection;
    private parseError;
}
//# sourceMappingURL=exception-capture.d.ts.map