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
 * import { LogSense } from "@logsense/node";
 * import { ProcessPlugin } from "@logsense/node";
 *
 * const sdk = new LogSense({ apiKey: "...", service: "api", environment: "production" });
 * const processPlugin = new ProcessPlugin(sdk);
 * processPlugin.install();
 * ```
 */
export class ProcessPlugin {
    private readonly client: LogSenseClient;
    private readonly exitCode: number;
    private readonly logBeforeExit: boolean;
    private isInstalled = false;

    constructor(client: LogSenseClient, options: ProcessPluginOptions = {}) {
        this.client = client;
        this.exitCode = options.exitCode ?? 0;
        this.logBeforeExit = options.logBeforeExit ?? true;
    }

    /**
     * Attach all process event listeners.
     * Safe to call multiple times — only installs once.
     */
    install(): void {
        if (this.isInstalled) {
            return;
        }

        process.on("SIGINT", this.handleSigInt);
        process.on("SIGTERM", this.handleSigTerm);

        if (this.logBeforeExit) {
            process.on("beforeExit", this.handleBeforeExit);
        }

        this.isInstalled = true;
    }

    /**
     * Detach all process event listeners registered by this plugin.
     */
    uninstall(): void {
        if (!this.isInstalled) {
            return;
        }

        process.off("SIGINT", this.handleSigInt);
        process.off("SIGTERM", this.handleSigTerm);
        process.off("beforeExit", this.handleBeforeExit);

        this.isInstalled = false;
    }

    // ─── Handlers (arrow functions to retain `this` binding) ───────────────────

    private readonly handleSigInt = async (): Promise<void> => {
        const { logger } = this.client;

        logger.warn("Process received SIGINT — initiating graceful shutdown", {
            event: "process.sigint",
            signal: "SIGINT",
            pid: process.pid,
        });

        await this.gracefulShutdown("SIGINT");
    };

    private readonly handleSigTerm = async (): Promise<void> => {
        const { logger } = this.client;

        logger.warn("Process received SIGTERM — initiating graceful shutdown", {
            event: "process.sigterm",
            signal: "SIGTERM",
            pid: process.pid,
        });

        await this.gracefulShutdown("SIGTERM");
    };

    private readonly handleBeforeExit = (): void => {
        const { logger } = this.client;

        logger.info("Process beforeExit — event loop is empty", {
            event: "process.beforeExit",
            pid: process.pid,
        });
    };

    // ─── Internal ──────────────────────────────────────────────────────────────

    private async gracefulShutdown(signal: string): Promise<void> {
        this.uninstall();

        try {
            await this.client.shutdown();
        } catch {
            // Shutdown errors must not prevent the process from exiting
        }

        process.exit(this.exitCode);
    }
}
