import {
    DatabaseEvent,
    Event,
    ExceptionEvent,
    HttpEvent,
} from "./types";

import { EventCategory } from "./constants";

export interface ValidationResult {
    valid: boolean;
    errors: string[];
}

export class EventValidator {
    /**
     * Entry Point
     */
    validate(event: Event): ValidationResult {
        const errors: string[] = [];

        this.validateBase(event, errors);

        switch (event.category) {
            case EventCategory.HTTP:
                this.validateHttp(event, errors);
                break;

            case EventCategory.DATABASE:
                this.validateDatabase(event, errors);
                break;

            case EventCategory.EXCEPTION:
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

    private validateBase(event: Event, errors: string[]) {
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

    private validateHttp(
        event: HttpEvent,
        errors: string[],
    ) {
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

    private validateDatabase(
        event: DatabaseEvent,
        errors: string[],
    ) {
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

    private validateException(
        event: ExceptionEvent,
        errors: string[],
    ) {
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

    assert(event: Event): void {
        const result = this.validate(event);

        if (!result.valid) {
            throw new Error(
                `Invalid Event:\n${result.errors.join("\n")}`,
            );
        }
    }
}

export const eventValidator = new EventValidator();