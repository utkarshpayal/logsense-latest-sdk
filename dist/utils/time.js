"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.now = now;
exports.nowMs = nowMs;
function now() {
    return new Date().toISOString();
}
function nowMs() {
    return Date.now();
}
//# sourceMappingURL=time.js.map