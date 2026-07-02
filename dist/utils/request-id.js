"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateRequestId = generateRequestId;
exports.extractRequestId = extractRequestId;
const id_js_1 = require("./id.js");
/**
 * Generates a unique request ID using the SDK's ID utility.
 *
 * @returns A new unique request ID string.
 */
function generateRequestId() {
    return (0, id_js_1.generateId)();
}
/**
 * Extracts a request ID from an incoming Express request.
 *
 * Checks the `X-Request-ID` and `X-Correlation-ID` headers (in that order).
 * If neither header is present, a new unique ID is generated.
 *
 * @param req - The incoming Express request object.
 * @returns The resolved request ID string.
 */
function extractRequestId(req) {
    const fromHeader = req.headers["x-request-id"] ??
        req.headers["x-correlation-id"];
    if (typeof fromHeader === "string" && fromHeader.trim().length > 0) {
        return fromHeader.trim();
    }
    return generateRequestId();
}
//# sourceMappingURL=request-id.js.map