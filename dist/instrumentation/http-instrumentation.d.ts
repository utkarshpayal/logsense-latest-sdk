import { Collector } from "../collector/collector";
import { TenantContext } from "../event/types";
export interface HttpServerInstrumentationOptions {
    collector: Collector;
    tenant: TenantContext;
    debug?: boolean;
}
export declare class HttpServerInstrumentation {
    private readonly collector;
    private readonly tenant;
    private readonly debug;
    private isPatched;
    private originalEmit;
    constructor(options: HttpServerInstrumentationOptions);
    register(): void;
    unregister(): void;
}
/**
 * Express Middleware helper.
 * Enriches request route properties dynamically inside the current context.
 */
export declare function expressMiddleware(): (req: any, res: any, next: any) => void;
/**
 * Fastify Plugin helper.
 * Enriches request route properties dynamically inside the current context.
 */
export declare function fastifyPlugin(): (fastify: any, opts: any, done: any) => void;
//# sourceMappingURL=http-instrumentation.d.ts.map