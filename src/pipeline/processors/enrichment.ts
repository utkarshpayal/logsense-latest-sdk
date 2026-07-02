import { hostname, arch, platform } from "node:os";
import { Event } from "../../event/types";
import { EventProcessor } from "../processor";

export interface EnrichmentOptions {
    sdkVersion: string;
    releaseVersion?: string;
    gitSha?: string;
    deploymentId?: string;
    region?: string;
}

export class EnrichmentProcessor implements EventProcessor {
    private readonly options: EnrichmentOptions;

    constructor(options: EnrichmentOptions) {
        this.options = options;
    }

    process(event: Event): Event {
        if (!event.runtime) {
            event.runtime = {};
        }

        event.runtime.hostname = event.runtime.hostname || hostname();
        event.runtime.nodeVersion = event.runtime.nodeVersion || process.version;
        event.runtime.sdkVersion = event.runtime.sdkVersion || this.options.sdkVersion;
        event.runtime.os = event.runtime.os || platform();
        event.runtime.arch = event.runtime.arch || arch();
        event.runtime.pid = event.runtime.pid || process.pid;

        const region = this.options.region || process.env.LOGSENSE_REGION || process.env.AWS_REGION;
        if (region) {
            event.runtime.region = region;
        }

        if (!event.metadata) {
            event.metadata = {};
        }

        const gitSha = this.options.gitSha || process.env.LOGSENSE_GIT_SHA || process.env.GIT_SHA;
        if (gitSha) {
            event.metadata.gitSha = gitSha;
        }

        const deploymentId = this.options.deploymentId || process.env.LOGSENSE_DEPLOYMENT_ID || process.env.DEPLOYMENT_ID;
        if (deploymentId) {
            event.metadata.deploymentId = deploymentId;
        }

        const releaseVersion = this.options.releaseVersion || process.env.LOGSENSE_RELEASE_VERSION || process.env.RELEASE_VERSION;
        if (releaseVersion) {
            event.metadata.release = releaseVersion;
        }

        return event;
    }
}
