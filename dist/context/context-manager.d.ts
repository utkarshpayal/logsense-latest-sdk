import { CreateRequestContextOptions, RequestContext } from "./request-context";
export declare class ContextManager {
    private requestCounter;
    /**
     * Create a new RequestContext object.
     */
    create(options: CreateRequestContextOptions): RequestContext;
    /**
     * Create a context and run the callback inside the storage context.
     */
    run<T>(options: CreateRequestContextOptions, callback: () => T): T;
    /**
     * Get the current RequestContext from the store.
     */
    current(): RequestContext | undefined;
    /**
     * Returns current request duration in milliseconds.
     */
    getDuration(): number | undefined;
}
export declare const contextManager: ContextManager;
//# sourceMappingURL=context-manager.d.ts.map