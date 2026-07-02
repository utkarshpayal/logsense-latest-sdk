import { Event } from "../../event/types";
import { EventProcessor } from "../processor";
export interface MaskingOptions {
    enabled?: boolean;
    keys?: string[];
    patterns?: string[];
}
export declare class MaskingProcessor implements EventProcessor {
    private readonly enabled;
    private readonly keysSet;
    private readonly patternRegexes;
    constructor(options?: MaskingOptions);
    process(event: Event): Event | null;
    private maskValue;
}
//# sourceMappingURL=masking.d.ts.map