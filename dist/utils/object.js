"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.omitUndefined = omitUndefined;
function omitUndefined(obj) {
    return Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== undefined));
}
//# sourceMappingURL=object.js.map