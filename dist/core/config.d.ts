import { Environment } from "../event/constants";
import { EventProcessor } from "../pipeline/processor";
import { LogSensePlugin } from "../pipeline/plugin";
export interface RetryConfig {
    maxAttempts?: number;
    backoffType?: "fixed" | "linear" | "exponential" | "jitter";
    baseDelayMs?: number;
    maxDelayMs?: number;
}
export interface SamplingConfig {
    type?: "fixed" | "adaptive" | "error-first" | "slow-first";
    strategy?: "fixed" | "adaptive" | "error-first" | "slow-first";
    rate?: number;
    minRate?: number;
    maxRate?: number;
    windowSizeMs?: number;
    maxEventsPerWindow?: number;
    slowThresholdMs?: number;
}
export interface MaskingConfig {
    enabled?: boolean;
    keys?: string[];
    patterns?: string[];
}
export interface SDKConfig {
    endpoint?: string;
    apiKey?: string;
    service?: string;
    environment?: Environment | string;
    serviceVersion?: string;
    organizationId?: string;
    projectId?: string;
    batchSize?: number;
    flushInterval?: number;
    retry?: RetryConfig;
    debug?: boolean;
    sampling?: SamplingConfig;
    masking?: MaskingConfig;
    plugins?: (EventProcessor | LogSensePlugin)[];
    diskQueueEnabled?: boolean;
    diskQueueDir?: string;
    disableInstrumentation?: boolean;
    profile?: "development" | "production" | "testing" | "serverless";
}
export declare const DEFAULT_CONFIG: {
    endpoint: string;
    environment: Environment;
    batchSize: number;
    flushInterval: number;
    debug: boolean;
    diskQueueEnabled: boolean;
    diskQueueDir: string;
    disableInstrumentation: boolean;
    retry: {
        maxAttempts: number;
        backoffType: "jitter";
        baseDelayMs: number;
        maxDelayMs: number;
    };
    masking: {
        enabled: boolean;
        keys: string[];
        patterns: never[];
    };
};
export interface ResolvedSDKConfig {
    endpoint: string;
    apiKey?: string | undefined;
    service?: string | undefined;
    environment: Environment | string;
    serviceVersion?: string | undefined;
    organizationId?: string | undefined;
    projectId?: string | undefined;
    batchSize: number;
    flushInterval: number;
    retry: {
        maxAttempts: number;
        backoffType: "fixed" | "linear" | "exponential" | "jitter";
        baseDelayMs: number;
        maxDelayMs: number;
    };
    debug: boolean;
    sampling?: SamplingConfig | undefined;
    masking: {
        enabled: boolean;
        keys: string[];
        patterns: string[];
    };
    plugins: (EventProcessor | LogSensePlugin)[];
    diskQueueEnabled: boolean;
    diskQueueDir: string;
    disableInstrumentation: boolean;
    profile?: "development" | "production" | "testing" | "serverless";
}
/**
 * Builds configuration by merging profile defaults, user-provided config, environment variables, and defaults.
 */
export declare function buildConfig(userConfig?: SDKConfig): ResolvedSDKConfig;
/**
 * Validates the generated configuration and throws detailed errors if any validation check fails.
 */
export declare function validateConfig(config: ResolvedSDKConfig): void;
//# sourceMappingURL=config.d.ts.map