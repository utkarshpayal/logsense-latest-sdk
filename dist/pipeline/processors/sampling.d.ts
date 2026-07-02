import { Event } from "../../event/types";
import { EventProcessor } from "../processor";
export interface SamplingOptions {
    type?: "fixed" | "adaptive" | "error-first" | "slow-first";
    strategy?: "fixed" | "adaptive" | "error-first" | "slow-first";
    rate?: number;
    minRate?: number;
    maxRate?: number;
    windowSizeMs?: number;
    maxEventsPerWindow?: number;
    slowThresholdMs?: number;
}
export declare class SamplingProcessor implements EventProcessor {
    private readonly strategy;
    private readonly rate;
    private readonly minRate;
    private readonly maxRate;
    private readonly windowSizeMs;
    private readonly maxEventsPerWindow;
    private windowStart;
    private eventCount;
    private adaptiveRate;
    private readonly slowThresholdMs;
    constructor(options: SamplingOptions);
    process(event: Event): Event | null;
    private processFixed;
    private processAdaptive;
    private processErrorFirst;
    private processSlowFirst;
    private hashString;
}
//# sourceMappingURL=sampling.d.ts.map