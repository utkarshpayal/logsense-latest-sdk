"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.eventValidator = exports.EventValidator = void 0;
const constants_1 = require("./constants");
class EventValidator {
    /**
     * Entry Point
     */
    validate(event) {
        const errors = [];
        this.validateBase(event, errors);
        switch (event.category) {
            case constants_1.EventCategory.HTTP:
                this.validateHttp(event, errors);
                break;
            case constants_1.EventCategory.DATABASE:
                this.validateDatabase(event, errors);
                break;
            case constants_1.EventCategory.EXCEPTION:
                this.validateException(event, errors);
                break;
            default:
                break;
        }
        return {
            valid: errors.length === 0,
            errors,
        };
    }
    // =====================================================
    // Base Validation
    // =====================================================
    validateBase(event, errors) {
        if (!event.version) {
            errors.push("version is required");
        }
        if (!event.category) {
            errors.push("category is required");
        }
        if (!event.type) {
            errors.push("type is required");
        }
        if (!event.action) {
            errors.push("action is required");
        }
        if (!event.severity) {
            errors.push("severity is required");
        }
        if (!event.timestamp) {
            errors.push("timestamp is required");
        }
        if (!event.relationships.eventId) {
            errors.push("eventId is required");
        }
        if (!event.tenant.organizationId) {
            errors.push("organizationId is required");
        }
        if (!event.tenant.projectId) {
            errors.push("projectId is required");
        }
        if (!event.tenant.environment) {
            errors.push("environment is required");
        }
        if (!event.tenant.service) {
            errors.push("service is required");
        }
    }
    // =====================================================
    // HTTP
    // =====================================================
    validateHttp(event, errors) {
        if (!event.http) {
            errors.push("http object is required");
            return;
        }
        if (!event.http.method) {
            errors.push("http.method is required");
        }
        if (!event.http.url) {
            errors.push("http.url is required");
        }
    }
    // =====================================================
    // Database
    // =====================================================
    validateDatabase(event, errors) {
        if (!event.database) {
            errors.push("database object is required");
            return;
        }
        if (!event.database.provider) {
            errors.push("database.provider is required");
        }
        if (!event.database.operation) {
            errors.push("database.operation is required");
        }
    }
    // =====================================================
    // Exception
    // =====================================================
    validateException(event, errors) {
        if (!event.exception) {
            errors.push("exception object is required");
            return;
        }
        if (!event.exception.name) {
            errors.push("exception.name is required");
        }
        if (!event.exception.message) {
            errors.push("exception.message is required");
        }
    }
    // =====================================================
    // Throws if invalid
    // =====================================================
    assert(event) {
        const result = this.validate(event);
        if (!result.valid) {
            throw new Error(`Invalid Event:\n${result.errors.join("\n")}`);
        }
    }
}
exports.EventValidator = EventValidator;
exports.eventValidator = new EventValidator();
//# sourceMappingURL=validator.js.map