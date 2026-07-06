import { LogSenseClient } from "../core/sdk.js";
/**
 * Options for `ProcessPlugin`.
 */
export interface ProcessPluginOptions {
    /**
     * Exit code used when the process exits after SIGINT or SIGTERM.
     * @default 0
     */
    exitCode?: number;
    /**
     * Whether to log `beforeExit` events.
     * @default true
     */
    logBeforeExit?: boolean;
}
/**
 * `ProcessPlugin` attaches listeners to key Node.js process lifecycle events
 * and logs them via the provided `LogSenseClient`.
 *
 * ### Events captured
 * - `SIGINT`   — e.g. Ctrl+C in terminal
 * - `SIGTERM`  — e.g. container orchestrator shutdown
 * - `beforeExit` — event loop is empty, process is about to exit
 *
 * Calling `uninstall()` removes all listeners cleanly.
 *
 * > Note: `uncaughtException` and `unhandledRejection` are handled by the
 * > SDK's built-in `ExceptionCapture` instrumentation and are not duplicated here.
 *
 * @example
 * ```ts
 * import { LogSense, ProcessPlugin } from "@utkarshpayal/logsense-sdk";
 *
 * const sdk = new LogSense({ apiKey: "...", service: "api", environment: "production" });
 * const processPlugin = new ProcessPlugin(sdk);
 * processPlugin.install();
 * ```
 */
export declare class ProcessPlugin {
    private readonly client;
    private readonly exitCode;
    private readonly logBeforeExit;
    private isInstalled;
    constructor(client: LogSenseClient, options?: ProcessPluginOptions);
    /**
     * Attach all process event listeners.
     * Safe to call multiple times — only installs once.
     */
    install(): void;
    /**
     * Detach all process event listeners registered by this plugin.
     */
    uninstall(): void;
    private readonly handleSigInt;
    private readonly handleSigTerm;
    private readonly handleBeforeExit;
    private gracefulShutdown;
}
//# sourceMappingURL=process.d.ts.map
