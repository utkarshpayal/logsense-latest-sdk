"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventPipeline = void 0;
class EventPipeline {
    processors = [];
    /**
     * Register processor.
     */
    use(processor) {
        this.processors.push(processor);
        return this;
    }
    /**
     * Remove every processor.
     */
    clear() {
        this.processors.length = 0;
    }
    /**
     * Number of processors.
     */
    size() {
        return this.processors.length;
    }
    /**
     * Execute pipeline.
     */
    async execute(event) {
        let current = event;
        for (const processor of this.processors) {
            if (!current) {
                return null;
            }
            current = await processor.process(current);
        }
        return current;
    }
}
exports.EventPipeline = EventPipeline;
//# sourceMappingURL=pipeline.js.map