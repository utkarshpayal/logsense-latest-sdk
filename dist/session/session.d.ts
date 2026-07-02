export declare class Session {
    readonly sessionId: string;
    userId?: string;
    readonly createdAt: number;
    lastAccessedAt: number;
    expiresAt: number;
    metadata: Record<string, any>;
    private readonly ttlMs;
    constructor(sessionId?: string, userId?: string, metadata?: Record<string, any>, ttlMs?: number);
    touch(): void;
    isExpired(): boolean;
    identify(userId: string, metadata?: Record<string, any>): void;
}
//# sourceMappingURL=session.d.ts.map