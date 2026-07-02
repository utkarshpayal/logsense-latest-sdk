import { EventCategory, EventStatus, Severity } from "../event/constants";
import { ExceptionContext } from "../event/types";
import { Collector } from "../collector/collector";

export interface ExceptionCaptureOptions {
    collector: Collector;
    onShutdown: () => Promise<void>;
    debug?: boolean;
}

export class ExceptionCapture {
    private readonly collector: Collector;
    private readonly onShutdown: () => Promise<void>;
    private readonly debug: boolean;
    private isRegistered = false;

    private originalUncaughtHandler: ((err: Error) => void) | null = null;

    constructor(options: ExceptionCaptureOptions) {
        this.collector = options.collector;
        this.onShutdown = options.onShutdown;
        this.debug = options.debug ?? false;
    }

    /**
     * Start intercepting uncaughtExceptions and unhandledRejections.
     */
    register(): void {
        if (this.isRegistered) {
            return;
        }

        process.on("uncaughtException", this.handleUncaughtException);
        process.on("unhandledRejection", this.handleUnhandledRejection);
        this.isRegistered = true;

        if (this.debug) {
            console.log("[LogSense] Exception capture instrumentation registered.");
        }
    }

    /**
     * Stop intercepting.
     */
    unregister(): void {
        if (!this.isRegistered) {
            return;
        }

        process.off("uncaughtException", this.handleUncaughtException);
        process.off("unhandledRejection", this.handleUnhandledRejection);
        this.isRegistered = false;
    }

    private handleUncaughtException = async (error: Error): Promise<void> => {
        if (this.debug) {
            console.error("[LogSense] Captured uncaught exception:", error);
        }

        const exceptionContext = this.parseError(error);

        try {
            await this.collector.collect<any>({
                category: EventCategory.EXCEPTION,
                type: "uncaughtException",
                action: EventStatus.FAILED,
                severity: Severity.FATAL,
                message: error.message || "Uncaught Exception",
                exception: exceptionContext,
            });

            // Flush the pipeline, send events, and stop timers before exiting
            await this.onShutdown();
        } catch (err) {
            console.error("[LogSense] Failed to collect/flush uncaught exception:", err);
        } finally {
            // Remove our listener and re-throw the error to let Node.js exit naturally
            this.unregister();
            // Let the process crash, or exit if no other listeners exist
            process.nextTick(() => {
                throw error;
            });
        }
    };

    private handleUnhandledRejection = async (reason: unknown): Promise<void> => {
        const error = reason instanceof Error ? reason : new Error(String(reason));
        if (this.debug) {
            console.error("[LogSense] Captured unhandled rejection:", error);
        }

        const exceptionContext = this.parseError(error);

        try {
            await this.collector.collect<any>({
                category: EventCategory.EXCEPTION,
                type: "unhandledRejection",
                action: EventStatus.FAILED,
                severity: Severity.ERROR,
                message: error.message || "Unhandled Rejection",
                exception: exceptionContext,
            });
        } catch (err) {
            console.error("[LogSense] Failed to collect unhandled rejection:", err);
        }
    };

    private parseError(error: Error): ExceptionContext {
        const context: ExceptionContext = {
            name: error.name || "Error",
            message: error.message || "Unknown error",
        };
        if (error.stack) {
            context.stack = error.stack;
        }

        const errWithCode = error as { code?: string; file?: string; line?: number };
        if (errWithCode.code) context.code = String(errWithCode.code);
        if (errWithCode.file) context.file = errWithCode.file;
        if (errWithCode.line) context.line = errWithCode.line;

        return context;
    }
}
