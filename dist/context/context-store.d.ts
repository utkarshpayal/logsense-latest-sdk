import { Actor } from "../event/types";
import { RequestContext } from "./request-context";
export declare class ContextStore {
    private readonly storage;
    /**
     * Run callback within a request context.
     */
    run<T>(context: RequestContext, callback: () => T): T;
    /**
     * Get the current request context.
     */
    get(): RequestContext | undefined;
    /**
     * Returns true if currently inside an active context.
     */
    hasContext(): boolean;
    /**
     * Replace actor (e.g. after authentication).
     */
    setActor(actor: Actor): void;
    /**
     * Update session ID.
     */
    setSession(sessionId: string): void;
    /**
     * Add custom metadata.
     */
    setMetadata(key: string, value: unknown): void;
    /**
     * Read custom metadata.
     */
    getMetadata<T = unknown>(key: string): T | undefined;
    /**
     * Disable storage (mainly for testing/cleanup).
     */
    disable(): void;
}
export declare const contextStore: ContextStore;
//# sourceMappingURL=context-store.d.ts.map