import { contextStore } from "../context/context-store";
import { nowMs } from "../utils/time";

export interface Breadcrumb {
    message: string;
    category?: string;
    level?: "debug" | "info" | "warn" | "error";
    timestamp: number;
    metadata?: Record<string, any>;
}

export class BreadcrumbManager {
    private readonly globalBreadcrumbs: Breadcrumb[] = [];
    private readonly limit: number;

    constructor(limit = 100) {
        this.limit = limit;
    }

    add(breadcrumb: Omit<Breadcrumb, "timestamp"> & { timestamp?: number }): void {
        const entry: Breadcrumb = {
            timestamp: breadcrumb.timestamp ?? nowMs(),
            message: breadcrumb.message,
            ...(breadcrumb.category !== undefined ? { category: breadcrumb.category } : {}),
            ...(breadcrumb.level !== undefined ? { level: breadcrumb.level } : {}),
            ...(breadcrumb.metadata !== undefined ? { metadata: breadcrumb.metadata } : {}),
        };

        const activeCtx = contextStore.get();
        if (activeCtx) {
            if (!activeCtx.metadata._breadcrumbs) {
                activeCtx.metadata._breadcrumbs = [];
            }
            const list = activeCtx.metadata._breadcrumbs as Breadcrumb[];
            list.push(entry);
            if (list.length > this.limit) {
                list.shift();
            }
        } else {
            this.globalBreadcrumbs.push(entry);
            if (this.globalBreadcrumbs.length > this.limit) {
                this.globalBreadcrumbs.shift();
            }
        }
    }

    get(): Breadcrumb[] {
        const activeCtx = contextStore.get();
        if (activeCtx && activeCtx.metadata._breadcrumbs) {
            return activeCtx.metadata._breadcrumbs as Breadcrumb[];
        }
        return this.globalBreadcrumbs;
    }

    clear(): void {
        const activeCtx = contextStore.get();
        if (activeCtx) {
            activeCtx.metadata._breadcrumbs = [];
        } else {
            this.globalBreadcrumbs.length = 0;
        }
    }
}

export const breadcrumbManager = new BreadcrumbManager();
