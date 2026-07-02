"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FingerprintGenerator = void 0;
const node_crypto_1 = require("node:crypto");
const constants_1 = require("../event/constants");
class FingerprintGenerator {
    /**
     * Generate a deterministic SHA-256 fingerprint for a given event.
     */
    static generate(event) {
        const hash = (0, node_crypto_1.createHash)("sha256");
        if (event.category === constants_1.EventCategory.EXCEPTION && event.exception) {
            const exc = event.exception;
            const name = exc.name || "Error";
            const message = exc.message || "";
            const stack = exc.stack || "";
            // Normalize stack trace: capture top frames, remove line/column numbers
            const normalizedStack = stack
                .split("\n")
                .slice(0, 4)
                .map((line) => line.replace(/\d+/g, "").trim())
                .join("\n");
            hash.update("exception:");
            hash.update(name);
            hash.update(message);
            hash.update(normalizedStack);
        }
        else if (event.category === constants_1.EventCategory.DATABASE && event.database) {
            const db = event.database;
            const provider = db.provider || "";
            const operation = db.operation || "";
            const table = db.table || "";
            const success = db.success ? "success" : "failed";
            hash.update("database:");
            hash.update(provider);
            hash.update(operation);
            hash.update(table);
            hash.update(success);
            if (db.query) {
                // Strip literal strings and digits to create a stable query template
                const queryTemplate = db.query
                    .replace(/'[^']*'/g, "?")
                    .replace(/\d+/g, "?");
                hash.update(queryTemplate);
            }
        }
        else if (event.category === constants_1.EventCategory.EXTERNAL && event.external) {
            const ext = event.external;
            const provider = ext.provider || "";
            const method = ext.method || "";
            const statusCode = String(ext.statusCode || "");
            const url = ext.url || "";
            const cleanUrl = url.split("?")[0].replace(/\d+/g, "?");
            hash.update("external:");
            hash.update(provider);
            hash.update(method);
            hash.update(statusCode);
            hash.update(cleanUrl);
        }
        else {
            hash.update("general:");
            hash.update(event.category || "");
            hash.update(event.type || "");
            hash.update(event.action || "");
            hash.update(event.message || "");
        }
        return hash.digest("hex");
    }
}
exports.FingerprintGenerator = FingerprintGenerator;
//# sourceMappingURL=fingerprint.js.map