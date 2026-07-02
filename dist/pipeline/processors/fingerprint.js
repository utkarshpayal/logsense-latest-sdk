"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FingerprintProcessor = void 0;
const fingerprint_1 = require("../../fingerprinting/fingerprint");
class FingerprintProcessor {
    process(event) {
        // Automatically generate fingerprint for exceptions and database/external HTTP failures
        if (event.category === "exception" ||
            (event.category === "database" && event.database?.success === false) ||
            (event.category === "external" && event.external?.success === false)) {
            if (!event.metadata) {
                event.metadata = {};
            }
            event.metadata.fingerprint = fingerprint_1.FingerprintGenerator.generate(event);
        }
        return event;
    }
}
exports.FingerprintProcessor = FingerprintProcessor;
//# sourceMappingURL=fingerprint.js.map