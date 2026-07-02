import { monitorEventLoopDelay, monitorEventLoopDelay as getLoopMonitor } from "node:perf_hooks";
import { EventCategory, EventStatus, Severity } from "../event/constants";
import { Collector } from "../collector/collector";

export interface RuntimeMonitorOptions {
    collector: Collector;
    intervalMs?: number;
    debug?: boolean;
}

export class RuntimeMonitor {
    private readonly collector: Collector;
    private readonly intervalMs: number;
    private readonly debug: boolean;

    private intervalTimer: NodeJS.Timeout | null = null;
    private loopMonitor: ReturnType<typeof getLoopMonitor> | null = null;
    private prevCpuUsage = process.cpuUsage();
    private prevCpuTime = Date.now();
    private isRunning = false;

    constructor(options: RuntimeMonitorOptions) {
        this.collector = options.collector;
        this.intervalMs = options.intervalMs ?? 10000; // default 10 seconds
        this.debug = options.debug ?? false;
    }

    /**
     * Start monitoring process metrics and capture startup event.
     */
    start(): void {
        if (this.isRunning) {
            return;
        }

        this.isRunning = true;

        // Start event loop delay monitor
        try {
            this.loopMonitor = monitorEventLoopDelay({ resolution: 10 });
            this.loopMonitor.enable();
        } catch (err) {
            if (this.debug) {
                console.warn("[LogSense] Failed to start native event loop monitor:", err);
            }
        }

        // Record process start event
        void this.recordLifecycleEvent("process.start", EventStatus.STARTED);

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
    stop(): void {
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

    private handleBeforeExit = (code: number): void => {
        const status = code === 0 ? EventStatus.COMPLETED : EventStatus.FAILED;
        // Since this is process exit, we fire the event and stop
        void this.recordLifecycleEvent("process.exit", status, { exitCode: code });
        this.stop();
    };

    private async recordLifecycleEvent(type: string, action: EventStatus, metadata: Record<string, any> = {}): Promise<void> {
        try {
            await this.collector.collect({
                category: EventCategory.RUNTIME,
                type,
                action,
                severity: Severity.INFO,
                message: `Process ${type.split(".")[1]} (PID: ${process.pid})`,
                metadata: {
                    pid: process.pid,
                    nodeVersion: process.version,
                    arch: process.arch,
                    platform: process.platform,
                    ...metadata,
                },
            });
        } catch (err) {
            if (this.debug) {
                console.error(`[LogSense] Failed to record runtime lifecycle event: ${type}`, err);
            }
        }
    }

    private async collectMetrics(): Promise<void> {
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

            await this.collector.collect<any>({
                category: EventCategory.RUNTIME,
                type: "metrics",
                action: EventStatus.COMPLETED,
                severity: Severity.DEBUG,
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
        } catch (err) {
            if (this.debug) {
                console.error("[LogSense] Failed to collect runtime metrics:", err);
            }
        }
    }
}
