import { Event } from "./types";
export interface ValidationResult {
    valid: boolean;
    errors: string[];
}
export declare class EventValidator {
    /**
     * Entry Point
     */
    validate(event: Event): ValidationResult;
    private validateBase;
    private validateHttp;
    private validateDatabase;
    private validateException;
    private validateOnboarding;
    assert(event: Event): void;
}
export declare const eventValidator: EventValidator;
//# sourceMappingURL=validator.d.ts.map