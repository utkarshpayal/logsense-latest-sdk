import { Session } from "./session";
import { contextStore } from "../context/context-store";
import { generateId } from "../utils/id";

export class SessionManager {
    private readonly sessions = new Map<string, Session>();
    private readonly ttlMs: number;

    constructor(ttlMs = 1800000) { // Default 30 mins
        this.ttlMs = ttlMs;
    }

    createSession(userId?: string, metadata?: Record<string, any>): Session {
        const session = new Session(generateId(), userId, metadata, this.ttlMs);
        this.sessions.set(session.sessionId, session);
        
        // Propagate to request context if active
        const activeCtx = contextStore.get();
        if (activeCtx) {
            activeCtx.sessionId = session.sessionId;
        }

        return session;
    }

    getSession(sessionId: string): Session | undefined {
        const session = this.sessions.get(sessionId);
        if (session) {
            if (session.isExpired()) {
                this.sessions.delete(sessionId);
                return undefined;
            }
            session.touch();
        }
        return session;
    }

    reconstructSession(sessionId: string, metadata?: Record<string, any>): Session {
        const existing = this.getSession(sessionId);
        if (existing) {
            if (metadata) {
                existing.metadata = { ...existing.metadata, ...metadata };
            }
            return existing;
        }

        const session = new Session(sessionId, undefined, metadata, this.ttlMs);
        this.sessions.set(sessionId, session);
        return session;
    }

    currentSession(): Session | undefined {
        const activeCtx = contextStore.get();
        if (!activeCtx) {
            return undefined;
        }

        let sessionId = activeCtx.sessionId;
        if (!sessionId) {
            const session = this.createSession();
            activeCtx.sessionId = session.sessionId;
            return session;
        }

        return this.reconstructSession(sessionId);
    }

    clearExpired(): void {
        for (const [id, session] of this.sessions.entries()) {
            if (session.isExpired()) {
                this.sessions.delete(id);
            }
        }
    }

    clearAll(): void {
        this.sessions.clear();
    }
}

export const sessionManager = new SessionManager();
