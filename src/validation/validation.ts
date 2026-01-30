import type { ValidationIssue, ValidationResult, ValidatorContext } from './validation.schemas.ts';
import { createSchemaValidator } from './validators/schema.ts';
import { createLintValidator } from './validators/lint.ts';
import { createSecretsValidator } from './validators/secrets.ts';

import type { ServiceContainer } from '#root/services/services.ts';
import type { AuditService } from '#root/audit/audit.ts';

type Validator = {
  name: string;
  validate: (context: ValidatorContext) => Promise<ValidationIssue[]>;
};

class ValidationService {
  #validators: Validator[] = [];
  #auditService: AuditService | null = null;

  constructor() {
    this.registerValidator(createSchemaValidator());
    this.registerValidator(createLintValidator());
    this.registerValidator(createSecretsValidator());
  }

  setAuditService = (auditService: AuditService): void => {
    this.#auditService = auditService;
  };

  #audit = async (ticketId: string | null, action: string): Promise<void> => {
    if (this.#auditService && ticketId) {
      await this.#auditService.log({
        ticketId,
        type: 'error_occurred',
        actor: 'system',
        action,
      });
    }
  };

  registerValidator = (validator: Validator): void => {
    const existingIndex = this.#validators.findIndex((v) => v.name === validator.name);
    if (existingIndex >= 0) {
      this.#validators[existingIndex] = validator;
    } else {
      this.#validators.push(validator);
    }
  };

  unregisterValidator = (name: string): boolean => {
    const index = this.#validators.findIndex((v) => v.name === name);
    if (index >= 0) {
      this.#validators.splice(index, 1);
      return true;
    }
    return false;
  };

  getValidators = (): Validator[] => {
    return [...this.#validators];
  };

  validate = async (context: ValidatorContext, ticketId?: string): Promise<ValidationResult> => {
    const validatorResults: ValidationResult['validatorResults'] = {};
    const allIssues: ValidationIssue[] = [];

    for (const validator of this.#validators) {
      try {
        const issues = await validator.validate(context);
        const hasErrors = issues.some((issue) => issue.severity === 'error');

        validatorResults[validator.name] = {
          valid: !hasErrors,
          issues,
        };

        allIssues.push(...issues);
      } catch (error) {
        const errorIssue: ValidationIssue = {
          severity: 'error',
          message: `Validator "${validator.name}" failed: ${(error as Error).message}`,
          rule: 'validator-error',
        };

        validatorResults[validator.name] = {
          valid: false,
          issues: [errorIssue],
        };

        allIssues.push(errorIssue);
      }
    }

    const hasErrors = allIssues.some((issue) => issue.severity === 'error');

    if (hasErrors && ticketId) {
      const errorCount = allIssues.filter((i) => i.severity === 'error').length;
      await this.#audit(ticketId, `Validation failed with ${errorCount} error(s)`);
    }

    return {
      valid: !hasErrors,
      issues: allIssues,
      validatorResults,
    };
  };

  validateFiles = async (
    worktreePath: string,
    files: string[],
    options?: { staged?: boolean; ticketId?: string },
  ): Promise<ValidationResult> => {
    const context: ValidatorContext = {
      worktreePath,
      files,
      staged: options?.staged ?? false,
    };

    return this.validate(context, options?.ticketId);
  };
}

const registerValidationService = (container: ServiceContainer): void => {
  container.register('validation', async (c) => {
    const service = new ValidationService();

    if (c.has('audit')) {
      const auditService = await c.resolve<AuditService>('audit');
      service.setAuditService(auditService);
    }

    return service;
  });
};

export type { Validator };
export { ValidationService, registerValidationService };
