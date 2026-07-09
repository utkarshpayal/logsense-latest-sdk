"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProcessPlugin = void 0;
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
class ProcessPlugin {
    client;
    exitCode;
    logBeforeExit;
    isInstalled = false;
    constructor(client, options = {}) {
        this.client = client;
        this.exitCode = options.exitCode ?? 0;
        this.logBeforeExit = options.logBeforeExit ?? true;
    }
    /**
     * Attach all process event listeners.
     * Safe to call multiple times — only installs once.
     */
    install() {
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
    uninstall() {
        if (!this.isInstalled) {
            return;
        }
        process.off("SIGINT", this.handleSigInt);
        process.off("SIGTERM", this.handleSigTerm);
        process.off("beforeExit", this.handleBeforeExit);
        this.isInstalled = false;
    }
    // ─── Handlers (arrow functions to retain `this` binding) ───────────────────
    handleSigInt = async () => {
        const { logger } = this.client;
        logger.warn("Process received SIGINT — initiating graceful shutdown", {
            event: "process.sigint",
            signal: "SIGINT",
            pid: process.pid,
        });
        await this.gracefulShutdown("SIGINT");
    };
    handleSigTerm = async () => {
        const { logger } = this.client;
        logger.warn("Process received SIGTERM — initiating graceful shutdown", {
            event: "process.sigterm",
            signal: "SIGTERM",
            pid: process.pid,
        });
        await this.gracefulShutdown("SIGTERM");
    };
    handleBeforeExit = () => {
        const { logger } = this.client;
        logger.info("Process beforeExit — event loop is empty", {
            event: "process.beforeExit",
            pid: process.pid,
        });
    };
    // ─── Internal ──────────────────────────────────────────────────────────────
    async gracefulShutdown(signal) {
        this.uninstall();
        try {
            await this.client.shutdown();
        }
        catch {
            // Shutdown errors must not prevent the process from exiting
        }
        process.exit(this.exitCode);
    }
}
exports.ProcessPlugin = ProcessPlugin;
//# sourceMappingURL=process.js.map