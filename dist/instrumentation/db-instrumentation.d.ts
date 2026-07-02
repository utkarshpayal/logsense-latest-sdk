import { DatabaseType } from "../event/constants";
import { Collector } from "../collector/collector";
export declare function prismaLogSenseExtension(collector: Collector, provider?: DatabaseType): (client: any) => any;
export declare function mongooseLogSensePlugin(schema: any, options: {
    collector: Collector;
}): void;
export declare function wrapPg(pgClientOrPool: any, collector: Collector): void;
export declare function wrapMysql2(mysqlConnectionOrPool: any, collector: Collector): void;
//# sourceMappingURL=db-instrumentation.d.ts.map