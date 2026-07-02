import { Collector } from "../collector/collector";
export interface HttpClientInstrumentationOptions {
    collector: Collector;
    sdkEndpoint: string;
    debug?: boolean;
}
export declare class HttpClientInstrumentation {
    private readonly collector;
    private readonly sdkEndpoint;
    private readonly debug;
    private isPatched;
    private originalHttpRequest;
    private originalHttpsRequest;
    constructor(options: HttpClientInstrumentationOptions);
    register(): void;
    unregister(): void;
}
//# sourceMappingURL=http-client-instrumentation.d.ts.map