class ValidationError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'ValidationError';
    this.code = code;
  }
}

class ValidatorNotFoundError extends ValidationError {
  validatorName: string;

  constructor(validatorName: string) {
    super(`Validator not found: ${validatorName}`, 'VALIDATOR_NOT_FOUND');
    this.name = 'ValidatorNotFoundError';
    this.validatorName = validatorName;
  }
}

class ValidationFailedError extends ValidationError {
  issueCount: number;

  constructor(issueCount: number) {
    super(`Validation failed with ${issueCount} error(s)`, 'VALIDATION_FAILED');
    this.name = 'ValidationFailedError';
    this.issueCount = issueCount;
  }
}

export { ValidationError, ValidatorNotFoundError, ValidationFailedError };
