"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExceptionCapture = void 0;
const constants_1 = require("../event/constants");
class ExceptionCapture {
    collector;
    onShutdown;
    debug;
    isRegistered = false;
    originalUncaughtHandler = null;
    constructor(options) {
        this.collector = options.collector;
        this.onShutdown = options.onShutdown;
        this.debug = options.debug ?? false;
    }
    /**
     * Start intercepting uncaughtExceptions and unhandledRejections.
     */
    register() {
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
    unregister() {
        if (!this.isRegistered) {
            return;
        }
        process.off("uncaughtException", this.handleUncaughtException);
        process.off("unhandledRejection", this.handleUnhandledRejection);
        this.isRegistered = false;
    }
    handleUncaughtException = async (error) => {
        if (this.debug) {
            console.error("[LogSense] Captured uncaught exception:", error);
        }
        const exceptionContext = this.parseError(error);
        try {
            await this.collector.collect({
                category: constants_1.EventCategory.EXCEPTION,
                type: "uncaughtException",
                action: constants_1.EventStatus.FAILED,
                severity: constants_1.Severity.FATAL,
                message: error.message || "Uncaught Exception",
                exception: exceptionContext,
            });
            // Flush the pipeline, send events, and stop timers before exiting
            await this.onShutdown();
        }
        catch (err) {
            console.error("[LogSense] Failed to collect/flush uncaught exception:", err);
        }
        finally {
            // Remove our listener and re-throw the error to let Node.js exit naturally
            this.unregister();
            // Let the process crash, or exit if no other listeners exist
            process.nextTick(() => {
                throw error;
            });
        }
    };
    handleUnhandledRejection = async (reason) => {
        const error = reason instanceof Error ? reason : new Error(String(reason));
        if (this.debug) {
            console.error("[LogSense] Captured unhandled rejection:", error);
        }
        const exceptionContext = this.parseError(error);
        try {
            await this.collector.collect({
                category: constants_1.EventCategory.EXCEPTION,
                type: "unhandledRejection",
                action: constants_1.EventStatus.FAILED,
                severity: constants_1.Severity.ERROR,
                message: error.message || "Unhandled Rejection",
                exception: exceptionContext,
            });
        }
        catch (err) {
            console.error("[LogSense] Failed to collect unhandled rejection:", err);
        }
    };
    parseError(error) {
        const context = {
            name: error.name || "Error",
            message: error.message || "Unknown error",
        };
        if (error.stack) {
            context.stack = error.stack;
        }
        const errWithCode = error;
        if (errWithCode.code)
            context.code = String(errWithCode.code);
        if (errWithCode.file)
            context.file = errWithCode.file;
        if (errWithCode.line)
            context.line = errWithCode.line;
        return context;
    }
}
exports.ExceptionCapture = ExceptionCapture;
//# sourceMappingURL=exception-capture.js.map