import { createHash } from "node:crypto";
import { Event } from "../event/types";
import { EventCategory } from "../event/constants";

export class FingerprintGenerator {
    /**
     * Generate a deterministic SHA-256 fingerprint for a given event.
     */
    static generate(event: Event): string {
        const hash = createHash("sha256");

        if (event.category === EventCategory.EXCEPTION && event.exception) {
            const exc = event.exception as any;
            const name = exc.name || "Error";
            const message = exc.message || "";
            const stack = exc.stack || "";

            // Normalize stack trace: capture top frames, remove line/column numbers
            const normalizedStack = stack
                .split("\n")
                .slice(0, 4)
                .map((line: string) => line.replace(/\d+/g, "").trim())
                .join("\n");

            hash.update("exception:");
            hash.update(name);
            hash.update(message);
            hash.update(normalizedStack);
        } else if (event.category === EventCategory.DATABASE && event.database) {
            const db = event.database as any;
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
        } else if (event.category === EventCategory.EXTERNAL && event.external) {
            const ext = event.external as any;
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
        } else {
            hash.update("general:");
            hash.update(event.category || "");
            hash.update(event.type || "");
            hash.update(event.action || "");
            hash.update(event.message || "");
        }

        return hash.digest("hex");
    }
}
