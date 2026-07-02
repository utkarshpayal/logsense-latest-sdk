"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnrichmentProcessor = void 0;
const node_os_1 = require("node:os");
class EnrichmentProcessor {
    options;
    constructor(options) {
        this.options = options;
    }
    process(event) {
        if (!event.runtime) {
            event.runtime = {};
        }
        event.runtime.hostname = event.runtime.hostname || (0, node_os_1.hostname)();
        event.runtime.nodeVersion = event.runtime.nodeVersion || process.version;
        event.runtime.sdkVersion = event.runtime.sdkVersion || this.options.sdkVersion;
        event.runtime.os = event.runtime.os || (0, node_os_1.platform)();
        event.runtime.arch = event.runtime.arch || (0, node_os_1.arch)();
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
exports.EnrichmentProcessor = EnrichmentProcessor;
//# sourceMappingURL=enrichment.js.map