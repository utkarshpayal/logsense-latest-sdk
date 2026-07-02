"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateId = generateId;
const node_crypto_1 = require("node:crypto");
function generateId() {
    return (0, node_crypto_1.randomUUID)();
}
//# sourceMappingURL=id.js.map