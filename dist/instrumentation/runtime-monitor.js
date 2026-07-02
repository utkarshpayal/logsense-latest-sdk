"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RuntimeMonitor = void 0;
const node_perf_hooks_1 = require("node:perf_hooks");
const constants_1 = require("../event/constants");
class RuntimeMonitor {
    collector;
    intervalMs;
    debug;
    intervalTimer = null;
    loopMonitor = null;
    prevCpuUsage = process.cpuUsage();
    prevCpuTime = Date.now();
    isRunning = false;
    constructor(options) {
        this.collector = options.collector;
        this.intervalMs = options.intervalMs ?? 10000; // default 10 seconds
        this.debug = options.debug ?? false;
    }
    /**
     * Start monitoring process metrics and capture startup event.
     */
    start() {
        if (this.isRunning) {
            return;
        }
        this.isRunning = true;
        // Start event loop delay monitor
        try {
            this.loopMonitor = (0, node_perf_hooks_1.monitorEventLoopDelay)({ resolution: 10 });
            this.loopMonitor.enable();
        }
        catch (err) {
            if (this.debug) {
                console.warn("[LogSense] Failed to start native event loop monitor:", err);
            }
        }
        // Record process start event
        void this.recordLifecycleEvent("process.start", constants_1.EventStatus.STARTED);
        // Schedule periodic metrics collection
        this.intervalTimer = setInterval(() => {
            void this.collectMetrics();
        }, this.intervalMs);
        // Track graceful process exit
        process.on("beforeExit", this.handleBeforeExit);
        if (this.debug) {
            console.log("[LogSense] Runtime monitor started.");
        }
    }
    /**
     * Stop monitoring.
     */
    stop() {
        if (!this.isRunning) {
            return;
        }
        if (this.intervalTimer) {
            clearInterval(this.intervalTimer);
            this.intervalTimer = null;
        }
        if (this.loopMonitor) {
            this.loopMonitor.disable();
            this.loopMonitor = null;
        }
        process.off("beforeExit", this.handleBeforeExit);
        this.isRunning = false;
        if (this.debug) {
            console.log("[LogSense] Runtime monitor stopped.");
        }
    }
    handleBeforeExit = (code) => {
        const status = code === 0 ? constants_1.EventStatus.COMPLETED : constants_1.EventStatus.FAILED;
        // Since this is process exit, we fire the event and stop
        void this.recordLifecycleEvent("process.exit", status, { exitCode: code });
        this.stop();
    };
    async recordLifecycleEvent(type, action, metadata = {}) {
        try {
            await this.collector.collect({
                category: constants_1.EventCategory.RUNTIME,
                type,
                action,
                severity: constants_1.Severity.INFO,
                message: `Process ${type.split(".")[1]} (PID: ${process.pid})`,
                metadata: {
                    pid: process.pid,
                    nodeVersion: process.version,
                    arch: process.arch,
                    platform: process.platform,
                    ...metadata,
                },
            });
        }
        catch (err) {
            if (this.debug) {
                console.error(`[LogSense] Failed to record runtime lifecycle event: ${type}`, err);
            }
        }
    }
    async collectMetrics() {
        try {
            // Memory calculations
            const memUsage = process.memoryUsage();
            // CPU calculations
            const currentCpu = process.cpuUsage();
            const currentTime = Date.now();
            const timeDeltaMs = currentTime - this.prevCpuTime;
            const cpuUserMs = (currentCpu.user - this.prevCpuUsage.user) / 1000;
            const cpuSystemMs = (currentCpu.system - this.prevCpuUsage.system) / 1000;
            const cpuTotalMs = cpuUserMs + cpuSystemMs;
            // CPU percentage relative to a single core
            const cpuPercent = timeDeltaMs > 0 ? (cpuTotalMs / timeDeltaMs) * 100 : 0;
            // Reset CPU stats for next calculation
            this.prevCpuUsage = currentCpu;
            this.prevCpuTime = currentTime;
            // Event loop delay calculation
            let eventLoopDelay = 0;
            if (this.loopMonitor) {
                // mean is in nanoseconds, convert to milliseconds
                eventLoopDelay = this.loopMonitor.mean / 1e6;
                this.loopMonitor.reset();
            }
            await this.collector.collect({
                category: constants_1.EventCategory.RUNTIME,
                type: "metrics",
                action: constants_1.EventStatus.COMPLETED,
                severity: constants_1.Severity.DEBUG,
                runtimeMetrics: {
                    cpu: parseFloat(cpuPercent.toFixed(2)),
                    memory: memUsage.rss,
                    heapUsed: memUsage.heapUsed,
                    heapTotal: memUsage.heapTotal,
                    eventLoopDelay: parseFloat(eventLoopDelay.toFixed(2)),
                },
                runtime: {
                    pid: process.pid,
                    cpu: parseFloat(cpuPercent.toFixed(2)),
                    memory: memUsage.rss,
                },
            });
        }
        catch (err) {
            if (this.debug) {
                console.error("[LogSense] Failed to collect runtime metrics:", err);
            }
        }
    }
}
exports.RuntimeMonitor = RuntimeMonitor;
//# sourceMappingURL=runtime-monitor.js.map