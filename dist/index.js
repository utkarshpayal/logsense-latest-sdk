"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MaskingProcessor = exports.SamplingProcessor = exports.extractRequestId = exports.generateRequestId = exports.ProcessPlugin = exports.LogSense = void 0;
// V2 Named Alias — allows `new LogSense(config)` alongside existing `LogSenseClient`
var sdk_js_1 = require("./core/sdk.js");
Object.defineProperty(exports, "LogSense", { enumerable: true, get: function () { return sdk_js_1.LogSenseClient; } });
// V2 Process Plugin
var process_js_1 = require("./plugins/process.js");
Object.defineProperty(exports, "ProcessPlugin", { enumerable: true, get: function () { return process_js_1.ProcessPlugin; } });
// V2 Request-ID Utility
var request_id_js_1 = require("./utils/request-id.js");
Object.defineProperty(exports, "generateRequestId", { enumerable: true, get: function () { return request_id_js_1.generateRequestId; } });
Object.defineProperty(exports, "extractRequestId", { enumerable: true, get: function () { return request_id_js_1.extractRequestId; } });
// Core Existing Exports
__exportStar(require("./context"), exports);
__exportStar(require("./event/builder"), exports);
__exportStar(require("./event/constants"), exports);
__exportStar(require("./event/types"), exports);
__exportStar(require("./event/validator"), exports);
__exportStar(require("./utils/object"), exports);
__exportStar(require("./utils/id"), exports);
__exportStar(require("./utils/time"), exports);
// SDK Core & Config Exports
__exportStar(require("./core/config"), exports);
__exportStar(require("./core/sdk"), exports);
// Logger Exports
__exportStar(require("./logger/logger"), exports);
// Retry Module Exports
__exportStar(require("./retry"), exports);
// Queue Module Exports
__exportStar(require("./queue"), exports);
// Monitoring Exports
__exportStar(require("./monitoring"), exports);
// Instrumentation Exports
__exportStar(require("./instrumentation"), exports);
// Pipeline Exports
__exportStar(require("./pipeline"), exports);
var sampling_1 = require("./pipeline/processors/sampling");
Object.defineProperty(exports, "SamplingProcessor", { enumerable: true, get: function () { return sampling_1.SamplingProcessor; } });
var masking_1 = require("./pipeline/processors/masking");
Object.defineProperty(exports, "MaskingProcessor", { enumerable: true, get: function () { return masking_1.MaskingProcessor; } });
//# sourceMappingURL=index.js.map