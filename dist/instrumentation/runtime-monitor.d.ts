import { Collector } from "../collector/collector";
export interface RuntimeMonitorOptions {
    collector: Collector;
    intervalMs?: number;
    debug?: boolean;
}
export declare class RuntimeMonitor {
    private readonly collector;
    private readonly intervalMs;
    private readonly debug;
    private intervalTimer;
    private loopMonitor;
    private prevCpuUsage;
    private prevCpuTime;
    private isRunning;
    constructor(options: RuntimeMonitorOptions);
    /**
     * Start monitoring process metrics and capture startup event.
     */
    start(): void;
    /**
     * Stop monitoring.
     */
    stop(): void;
    private handleBeforeExit;
    private recordLifecycleEvent;
    private collectMetrics;
}
//# sourceMappingURL=runtime-monitor.d.ts.map