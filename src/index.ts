// V2 Named Alias — allows `new LogSense(config)` alongside existing `LogSenseClient`
export { LogSenseClient as LogSense } from "./core/sdk.js";

// V2 Process Plugin
export { ProcessPlugin } from "./plugins/process.js";
export type { ProcessPluginOptions } from "./plugins/process.js";

// V2 Request-ID Utility
export { generateRequestId, extractRequestId } from "./utils/request-id.js";

// Core Existing Exports
export * from "./context";
export * from "./event/builder";
export * from "./event/constants";
export * from "./event/types";
export * from "./event/validator";
export * from "./utils/object";
export * from "./utils/id";
export * from "./utils/time";

// SDK Core & Config Exports
export * from "./core/config";
export * from "./core/sdk";

// Logger Exports
export * from "./logger/logger";

// Retry Module Exports
export * from "./retry";

// Queue Module Exports
export * from "./queue";

// Monitoring Exports
export * from "./monitoring";

// Instrumentation Exports
export * from "./instrumentation";

// Pipeline Exports
export * from "./pipeline";
export { SamplingProcessor } from "./pipeline/processors/sampling";
export { MaskingProcessor } from "./pipeline/processors/masking";
export { EventProcessor } from "./pipeline/processor";
