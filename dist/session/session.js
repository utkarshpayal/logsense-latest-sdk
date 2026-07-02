"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Session = void 0;
const id_1 = require("../utils/id");
const time_1 = require("../utils/time");
class Session {
    sessionId;
    userId;
    createdAt;
    lastAccessedAt;
    expiresAt;
    metadata;
    ttlMs;
    constructor(sessionId = (0, id_1.generateId)(), userId, metadata = {}, ttlMs = 1800000) {
        this.sessionId = sessionId;
        if (userId !== undefined) {
            this.userId = userId;
        }
        this.metadata = metadata;
        this.createdAt = (0, time_1.nowMs)();
        this.lastAccessedAt = this.createdAt;
        this.ttlMs = ttlMs;
        this.expiresAt = this.createdAt + ttlMs;
    }
    touch() {
        this.lastAccessedAt = (0, time_1.nowMs)();
        this.expiresAt = this.lastAccessedAt + this.ttlMs;
    }
    isExpired() {
        return (0, time_1.nowMs)() > this.expiresAt;
    }
    identify(userId, metadata) {
        this.userId = userId;
        if (metadata) {
            this.metadata = { ...this.metadata, ...metadata };
        }
        this.touch();
    }
}
exports.Session = Session;
//# sourceMappingURL=session.js.map