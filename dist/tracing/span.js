"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Span = void 0;
const id_1 = require("../utils/id");
const time_1 = require("../utils/time");
const constants_1 = require("../event/constants");
class Span {
    spanId;
    traceId;
    parentSpanId;
    name;
    startTime;
    endTime;
    duration;
    status = constants_1.EventStatus.STARTED;
    attributes = {};
    events = [];
    collector;
    constructor(name, collector, traceId, parentSpanId, startTime = (0, time_1.nowMs)()) {
        this.name = name;
        this.collector = collector;
        this.traceId = traceId;
        if (parentSpanId !== undefined) {
            this.parentSpanId = parentSpanId;
        }
        this.spanId = (0, id_1.generateId)();
        this.startTime = startTime;
    }
    setAttribute(key, value) {
        this.attributes[key] = value;
        return this;
    }
    setAttributes(attributes) {
        this.attributes = { ...this.attributes, ...attributes };
        return this;
    }
    addEvent(name, attributes) {
        this.events.push({
            name,
            timestamp: (0, time_1.nowMs)(),
            ...(attributes !== undefined ? { attributes } : {}),
        });
        return this;
    }
    recordException(error) {
        const err = error instanceof Error ? error : new Error(String(error));
        this.status = constants_1.EventStatus.FAILED;
        this.addEvent("exception", {
            "exception.type": err.name,
            "exception.message": err.message,
            "exception.stacktrace": err.stack,
        });
        return this;
    }
    end(endTime = (0, time_1.nowMs)()) {
        if (this.endTime)
            return; // Already ended
        this.endTime = endTime;
        this.duration = this.endTime - this.startTime;
        if (this.status === constants_1.EventStatus.STARTED) {
            this.status = constants_1.EventStatus.SUCCESS;
        }
        // Collect span telemetry event
        void this.collector.collect({
            category: constants_1.EventCategory.CUSTOM,
            type: "span",
            action: this.status,
            severity: this.status === constants_1.EventStatus.FAILED ? constants_1.Severity.ERROR : constants_1.Severity.INFO,
            message: `Span ${this.name} ${this.status}`,
            duration: this.duration,
            relationships: {
                eventId: "",
                traceId: this.traceId,
                spanId: this.spanId,
                ...(this.parentSpanId !== undefined ? { parentEventId: this.parentSpanId } : {}),
            },
            metadata: {
                spanName: this.name,
                startTime: this.startTime,
                endTime: this.endTime,
                attributes: this.attributes,
                events: this.events,
            }
        });
    }
}
exports.Span = Span;
//# sourceMappingURL=span.js.map