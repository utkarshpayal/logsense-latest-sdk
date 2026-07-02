"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_CONFIG = void 0;
exports.buildConfig = buildConfig;
exports.validateConfig = validateConfig;
const constants_1 = require("../event/constants");
exports.DEFAULT_CONFIG = {
    endpoint: "https://api.logsense.com/v1/events",
    environment: constants_1.Environment.DEVELOPMENT,
    batchSize: 100,
    flushInterval: 5000,
    debug: false,
    diskQueueEnabled: false,
    diskQueueDir: ".logsense/queue",
    disableInstrumentation: false,
    retry: {
        maxAttempts: 5,
        backoffType: "jitter",
        baseDelayMs: 1000,
        maxDelayMs: 30000,
    },
    masking: {
        enabled: true,
        keys: ["password", "token", "cookie", "authorization", "apiKey", "secret", "passwd", "access_token", "client_secret"],
        patterns: [],
    },
};
/**
 * Builds configuration by merging profile defaults, user-provided config, environment variables, and defaults.
 */
function buildConfig(userConfig) {
    const env = process.env;
    // 1. Resolve Profile
    const resolvedProfile = userConfig?.profile ||
        env["LOGSENSE_PROFILE"] ||
        (env["NODE_ENV"] === "test"
            ? "testing"
            : env["NODE_ENV"] === "production"
                ? "production"
                : "development");
    // 2. Setup Profile Defaults
    let profileRetry = {};
    let profileSampling;
    let profileFlushInterval = exports.DEFAULT_CONFIG.flushInterval;
    let profileDiskQueueEnabled = exports.DEFAULT_CONFIG.diskQueueEnabled;
    let profileDebug = exports.DEFAULT_CONFIG.debug;
    switch (resolvedProfile) {
        case "production":
            profileRetry = { maxAttempts: 5, backoffType: "jitter", baseDelayMs: 1000, maxDelayMs: 30000 };
            profileSampling = { strategy: "adaptive", type: "adaptive" };
            profileDiskQueueEnabled = true;
            profileDebug = false;
            break;
        case "testing":
            profileRetry = { maxAttempts: 0 };
            profileSampling = { strategy: "fixed", type: "fixed", rate: 1.0 };
            profileFlushInterval = 1;
            profileDiskQueueEnabled = false;
            profileDebug = true;
            break;
        case "serverless":
            profileRetry = { maxAttempts: 3, baseDelayMs: 1000 };
            profileSampling = { strategy: "fixed", type: "fixed", rate: 1.0 };
            profileFlushInterval = 1;
            profileDiskQueueEnabled = false;
            profileDebug = false;
            break;
        case "development":
        default:
            profileRetry = { maxAttempts: 3, backoffType: "jitter", baseDelayMs: 500, maxDelayMs: 5000 };
            profileSampling = { strategy: "fixed", type: "fixed", rate: 1.0 };
            profileFlushInterval = 1000;
            profileDiskQueueEnabled = false;
            profileDebug = true;
            break;
    }
    const detectedEnv = env["LOGSENSE_ENVIRONMENT"] || env["NODE_ENV"] || exports.DEFAULT_CONFIG.environment;
    const mergedRetry = {
        ...exports.DEFAULT_CONFIG.retry,
        ...profileRetry,
        ...userConfig?.retry,
    };
    const mergedMasking = {
        ...exports.DEFAULT_CONFIG.masking,
        ...userConfig?.masking,
    };
    const mergedSampling = userConfig?.sampling || profileSampling;
    const config = {
        endpoint: userConfig?.endpoint || env["LOGSENSE_ENDPOINT"] || exports.DEFAULT_CONFIG.endpoint,
        apiKey: userConfig?.apiKey || env["LOGSENSE_API_KEY"],
        service: userConfig?.service || env["LOGSENSE_SERVICE"],
        environment: userConfig?.environment || detectedEnv,
        serviceVersion: userConfig?.serviceVersion || env["LOGSENSE_SERVICE_VERSION"],
        organizationId: userConfig?.organizationId || env["LOGSENSE_ORG_ID"] || env["LOGSENSE_ORGANIZATION_ID"],
        projectId: userConfig?.projectId || env["LOGSENSE_PROJECT_ID"],
        batchSize: userConfig?.batchSize ?? (env["LOGSENSE_BATCH_SIZE"] ? parseInt(env["LOGSENSE_BATCH_SIZE"], 10) : exports.DEFAULT_CONFIG.batchSize),
        flushInterval: userConfig?.flushInterval ?? (env["LOGSENSE_FLUSH_INTERVAL"] ? parseInt(env["LOGSENSE_FLUSH_INTERVAL"], 10) : profileFlushInterval),
        retry: mergedRetry,
        debug: userConfig?.debug ?? (env["LOGSENSE_DEBUG"] === "true" || profileDebug),
        sampling: mergedSampling,
        masking: mergedMasking,
        plugins: userConfig?.plugins || [],
        diskQueueEnabled: userConfig?.diskQueueEnabled ?? (env["LOGSENSE_DISK_QUEUE_ENABLED"] === "true" || profileDiskQueueEnabled),
        diskQueueDir: userConfig?.diskQueueDir || env["LOGSENSE_DISK_QUEUE_DIR"] || exports.DEFAULT_CONFIG.diskQueueDir,
        disableInstrumentation: userConfig?.disableInstrumentation ?? (env["LOGSENSE_DISABLE_INSTRUMENTATION"] === "true" || exports.DEFAULT_CONFIG.disableInstrumentation),
        profile: resolvedProfile,
    };
    return config;
}
/**
 * Validates the generated configuration and throws detailed errors if any validation check fails.
 */
function validateConfig(config) {
    const errors = [];
    if (!config.apiKey) {
        errors.push("apiKey is required (or LOGSENSE_API_KEY environment variable)");
    }
    if (!config.service) {
        errors.push("service is required (or LOGSENSE_SERVICE environment variable)");
    }
    if (!config.organizationId) {
        errors.push("organizationId is required (or LOGSENSE_ORGANIZATION_ID environment variable)");
    }
    if (!config.projectId) {
        errors.push("projectId is required (or LOGSENSE_PROJECT_ID environment variable)");
    }
    if (config.batchSize <= 0) {
        errors.push("batchSize must be greater than 0");
    }
    if (config.flushInterval <= 0) {
        errors.push("flushInterval must be greater than 0");
    }
    if (config.retry.maxAttempts !== undefined && config.retry.maxAttempts < 0) {
        errors.push("retry.maxAttempts must be greater than or equal to 0");
    }
    if (config.retry.baseDelayMs !== undefined && config.retry.baseDelayMs <= 0) {
        errors.push("retry.baseDelayMs must be greater than 0");
    }
    if (config.retry.maxDelayMs !== undefined && config.retry.maxDelayMs <= 0) {
        errors.push("retry.maxDelayMs must be greater than 0");
    }
    if (config.sampling) {
        const strategy = config.sampling.strategy ?? config.sampling.type;
        if (strategy) {
            if (!["fixed", "adaptive", "error-first", "slow-first"].includes(strategy)) {
                errors.push(`Invalid sampling strategy: "${strategy}". Must be "fixed", "adaptive", "error-first", or "slow-first".`);
            }
            if (strategy === "fixed" && config.sampling.rate !== undefined) {
                if (config.sampling.rate < 0 || config.sampling.rate > 1) {
                    errors.push("sampling.rate must be between 0 and 1 for fixed sampling");
                }
            }
            if (strategy === "adaptive") {
                if (config.sampling.windowSizeMs !== undefined && config.sampling.windowSizeMs <= 0) {
                    errors.push("sampling.windowSizeMs must be greater than 0");
                }
                if (config.sampling.maxEventsPerWindow !== undefined && config.sampling.maxEventsPerWindow <= 0) {
                    errors.push("sampling.maxEventsPerWindow must be greater than 0");
                }
            }
        }
    }
    if (errors.length > 0) {
        throw new Error(`[LogSense] Invalid Configuration:\n- ${errors.join("\n- ")}`);
    }
}
//# sourceMappingURL=config.js.map