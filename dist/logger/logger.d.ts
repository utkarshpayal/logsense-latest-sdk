import { Metadata } from "../event/types";
import { Collector } from "../collector/collector";
export interface LogSenseLogger {
    trace(message: string, metadata?: Metadata): void;
    debug(message: string, metadata?: Metadata): void;
    info(message: string, metadata?: Metadata): void;
    warn(message: string, metadata?: Metadata): void;
    error(message: string, error?: Error | unknown, metadata?: Metadata): void;
    fatal(message: string, error?: Error | unknown, metadata?: Metadata): void;
}
export declare class ProductionLogger implements LogSenseLogger {
    private readonly collector;
    private readonly debugMode;
    constructor(collector: Collector, debugMode?: boolean);
    trace(message: string, metadata?: Metadata): void;
    debug(message: string, metadata?: Metadata): void;
    info(message: string, metadata?: Metadata): void;
    warn(message: string, metadata?: Metadata): void;
    error(message: string, error?: Error | unknown, metadata?: Metadata): void;
    fatal(message: string, error?: Error | unknown, metadata?: Metadata): void;
    private log;
    private parseError;
}
//# sourceMappingURL=logger.d.ts.map