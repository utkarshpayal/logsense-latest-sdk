import { generateId } from "../utils/id";
import { nowMs } from "../utils/time";

export class Session {
    public readonly sessionId: string;
    public userId?: string;
    public readonly createdAt: number;
    public lastAccessedAt: number;
    public expiresAt: number;
    public metadata: Record<string, any>;
    private readonly ttlMs: number;

    constructor(sessionId = generateId(), userId?: string, metadata: Record<string, any> = {}, ttlMs = 1800000) {
        this.sessionId = sessionId;
        if (userId !== undefined) {
            this.userId = userId;
        }
        this.metadata = metadata;
        this.createdAt = nowMs();
        this.lastAccessedAt = this.createdAt;
        this.ttlMs = ttlMs;
        this.expiresAt = this.createdAt + ttlMs;
    }

    touch(): void {
        this.lastAccessedAt = nowMs();
        this.expiresAt = this.lastAccessedAt + this.ttlMs;
    }

    isExpired(): boolean {
        return nowMs() > this.expiresAt;
    }

    identify(userId: string, metadata?: Record<string, any>): void {
        this.userId = userId;
        if (metadata) {
            this.metadata = { ...this.metadata, ...metadata };
        }
        this.touch();
    }
}
