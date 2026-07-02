import { Event } from "../../event/types";
import { EventProcessor } from "../processor";
export interface EnrichmentOptions {
    sdkVersion: string;
    releaseVersion?: string;
    gitSha?: string;
    deploymentId?: string;
    region?: string;
}
export declare class EnrichmentProcessor implements EventProcessor {
    private readonly options;
    constructor(options: EnrichmentOptions);
    process(event: Event): Event;
}
//# sourceMappingURL=enrichment.d.ts.map