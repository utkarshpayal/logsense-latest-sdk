"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductionLogger = void 0;
const constants_1 = require("../event/constants");
class ProductionLogger {
    collector;
    debugMode;
    constructor(collector, debugMode = false) {
        this.collector = collector;
        this.debugMode = debugMode;
    }
    trace(message, metadata) {
        this.log(constants_1.Severity.TRACE, message, undefined, metadata);
    }
    debug(message, metadata) {
        this.log(constants_1.Severity.DEBUG, message, undefined, metadata);
    }
    info(message, metadata) {
        this.log(constants_1.Severity.INFO, message, undefined, metadata);
    }
    warn(message, metadata) {
        this.log(constants_1.Severity.WARN, message, undefined, metadata);
    }
    error(message, error, metadata) {
        this.log(constants_1.Severity.ERROR, message, error, metadata);
    }
    fatal(message, error, metadata) {
        this.log(constants_1.Severity.FATAL, message, error, metadata);
    }
    log(severity, message, error, metadata) {
        // In debug mode, print logs to stdout/stderr using standard console
        if (this.debugMode) {
            const timestamp = new Date().toISOString();
            const logFn = severity === constants_1.Severity.ERROR || severity === constants_1.Severity.FATAL ? console.error : console.log;
            logFn(`[${timestamp}] [LogSense SDK Debug] [${severity.toUpperCase()}] ${message}`, error || "", metadata || "");
        }
        const partialEvent = {
            category: error ? constants_1.EventCategory.EXCEPTION : constants_1.EventCategory.CUSTOM,
            type: error ? "exception" : "log",
            action: constants_1.EventStatus.COMPLETED,
            severity,
            message,
            metadata,
        };
        if (error) {
            const exceptionContext = this.parseError(error);
            partialEvent.exception = exceptionContext;
        }
        // Fire and forget log collection to avoid blocking application code execution
        void this.collector.collect(partialEvent).catch((err) => {
            if (this.debugMode) {
                console.error("[LogSense] Failed to collect log event:", err);
            }
        });
    }
    parseError(error) {
        if (error instanceof Error) {
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
        return {
            name: "Error",
            message: String(error),
        };
    }
}
exports.ProductionLogger = ProductionLogger;
//# sourceMappingURL=logger.js.map