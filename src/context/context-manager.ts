import { generateId } from "../utils/id";
import { omitUndefined } from "../utils/object";
import { nowMs } from "../utils/time";
import { contextStore } from "./context-store";
import { CreateRequestContextOptions, RequestContext } from "./request-context";

export class ContextManager {
    private requestCounter = 0;

    /**
     * Create a new RequestContext object.
     */
    create(options: CreateRequestContextOptions): RequestContext {
        this.requestCounter++;

        return omitUndefined({
            requestId: options.requestId ?? generateId(),
            traceId: options.traceId ?? generateId(),
            sessionId: options.sessionId,
            spanId: options.spanId,
            correlationId: options.correlationId,
            parentEventId: options.parentEventId,
            tenant: options.tenant,
            actor: options.actor,
            startTime: nowMs(),
            requestNumber: this.requestCounter,
            metadata: options.metadata ?? {},
        }) as RequestContext;
    }

    /**
     * Create a context and run the callback inside the storage context.
     */
    run<T>(options: CreateRequestContextOptions, callback: () => T): T {
        const context = this.create(options);
        return contextStore.run(context, callback);
    }

    /**
     * Get the current RequestContext from the store.
     */
    current(): RequestContext | undefined {
        return contextStore.get();
    }

    /**
     * Returns current request duration in milliseconds.
     */
    getDuration(): number | undefined {
        const ctx = contextStore.get();
        if (!ctx) {
            return undefined;
        }
        return nowMs() - ctx.startTime;
    }
}

export const contextManager = new ContextManager();
