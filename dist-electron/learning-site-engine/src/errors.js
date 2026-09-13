export class LearningSiteError extends Error {
    code;
    details;
    constructor(code, message, details = {}) {
        super(message);
        this.code = code;
        this.details = details;
        this.name = "LearningSiteError";
    }
}
export class ValidationError extends LearningSiteError {
    constructor(message, details = {}) { super("VALIDATION_FAILED", message, details); this.name = "ValidationError"; }
}
export class MigrationError extends LearningSiteError {
    constructor(message, details = {}) { super("MIGRATION_FAILED", message, details); this.name = "MigrationError"; }
}
