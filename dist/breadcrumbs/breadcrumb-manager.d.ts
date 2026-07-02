export interface Breadcrumb {
    message: string;
    category?: string;
    level?: "debug" | "info" | "warn" | "error";
    timestamp: number;
    metadata?: Record<string, any>;
}
export declare class BreadcrumbManager {
    private readonly globalBreadcrumbs;
    private readonly limit;
    constructor(limit?: number);
    add(breadcrumb: Omit<Breadcrumb, "timestamp"> & {
        timestamp?: number;
    }): void;
    get(): Breadcrumb[];
    clear(): void;
}
export declare const breadcrumbManager: BreadcrumbManager;
//# sourceMappingURL=breadcrumb-manager.d.ts.map