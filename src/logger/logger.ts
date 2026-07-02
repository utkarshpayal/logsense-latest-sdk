import { EventCategory, EventStatus, Severity } from "../event/constants";
import { ExceptionContext, Metadata } from "../event/types";
import { Collector } from "../collector/collector";

export interface LogSenseLogger {
    trace(message: string, metadata?: Metadata): void;
    debug(message: string, metadata?: Metadata): void;
    info(message: string, metadata?: Metadata): void;
    warn(message: string, metadata?: Metadata): void;
    error(message: string, error?: Error | unknown, metadata?: Metadata): void;
    fatal(message: string, error?: Error | unknown, metadata?: Metadata): void;
}

export class ProductionLogger implements LogSenseLogger {
    constructor(
        private readonly collector: Collector,
        private readonly debugMode: boolean = false,
    ) {}

    trace(message: string, metadata?: Metadata): void {
        this.log(Severity.TRACE, message, undefined, metadata);
    }

    debug(message: string, metadata?: Metadata): void {
        this.log(Severity.DEBUG, message, undefined, metadata);
    }

    info(message: string, metadata?: Metadata): void {
        this.log(Severity.INFO, message, undefined, metadata);
    }

    warn(message: string, metadata?: Metadata): void {
        this.log(Severity.WARN, message, undefined, metadata);
    }

    error(message: string, error?: Error | unknown, metadata?: Metadata): void {
        this.log(Severity.ERROR, message, error, metadata);
    }

    fatal(message: string, error?: Error | unknown, metadata?: Metadata): void {
        this.log(Severity.FATAL, message, error, metadata);
    }

    private log(
        severity: Severity,
        message: string,
        error?: Error | unknown,
        metadata?: Metadata,
    ): void {
        // In debug mode, print logs to stdout/stderr using standard console
        if (this.debugMode) {
            const timestamp = new Date().toISOString();
            const logFn = severity === Severity.ERROR || severity === Severity.FATAL ? console.error : console.log;
            logFn(`[${timestamp}] [LogSense SDK Debug] [${severity.toUpperCase()}] ${message}`, error || "", metadata || "");
        }

        const partialEvent: any = {
            category: error ? EventCategory.EXCEPTION : EventCategory.CUSTOM,
            type: error ? "exception" : "log",
            action: EventStatus.COMPLETED,
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

    private parseError(error: Error | unknown): ExceptionContext {
        if (error instanceof Error) {
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

        return {
            name: "Error",
            message: String(error),
        };
    }
}
