import { Session } from "./session";
export declare class SessionManager {
    private readonly sessions;
    private readonly ttlMs;
    constructor(ttlMs?: number);
    createSession(userId?: string, metadata?: Record<string, any>): Session;
    getSession(sessionId: string): Session | undefined;
    reconstructSession(sessionId: string, metadata?: Record<string, any>): Session;
    currentSession(): Session | undefined;
    clearExpired(): void;
    clearAll(): void;
}
export declare const sessionManager: SessionManager;
//# sourceMappingURL=session-manager.d.ts.map