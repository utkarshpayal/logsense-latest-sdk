"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sessionManager = exports.SessionManager = void 0;
const session_1 = require("./session");
const context_store_1 = require("../context/context-store");
const id_1 = require("../utils/id");
class SessionManager {
    sessions = new Map();
    ttlMs;
    constructor(ttlMs = 1800000) {
        this.ttlMs = ttlMs;
    }
    createSession(userId, metadata) {
        const session = new session_1.Session((0, id_1.generateId)(), userId, metadata, this.ttlMs);
        this.sessions.set(session.sessionId, session);
        // Propagate to request context if active
        const activeCtx = context_store_1.contextStore.get();
        if (activeCtx) {
            activeCtx.sessionId = session.sessionId;
        }
        return session;
    }
    getSession(sessionId) {
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
    reconstructSession(sessionId, metadata) {
        const existing = this.getSession(sessionId);
        if (existing) {
            if (metadata) {
                existing.metadata = { ...existing.metadata, ...metadata };
            }
            return existing;
        }
        const session = new session_1.Session(sessionId, undefined, metadata, this.ttlMs);
        this.sessions.set(sessionId, session);
        return session;
    }
    currentSession() {
        const activeCtx = context_store_1.contextStore.get();
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
    clearExpired() {
        for (const [id, session] of this.sessions.entries()) {
            if (session.isExpired()) {
                this.sessions.delete(id);
            }
        }
    }
    clearAll() {
        this.sessions.clear();
    }
}
exports.SessionManager = SessionManager;
exports.sessionManager = new SessionManager();
//# sourceMappingURL=session-manager.js.map