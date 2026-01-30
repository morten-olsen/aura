import { z } from 'zod';

const validationIssueSeveritySchema = z.enum(['error', 'warning', 'info']);

type ValidationIssueSeverity = z.infer<typeof validationIssueSeveritySchema>;

const validationIssueSchema = z.object({
  severity: validationIssueSeveritySchema,
  message: z.string(),
  file: z.string().optional(),
  line: z.number().optional(),
  column: z.number().optional(),
  rule: z.string().optional(),
});

type ValidationIssue = z.infer<typeof validationIssueSchema>;

const validationResultSchema = z.object({
  valid: z.boolean(),
  issues: z.array(validationIssueSchema),
  validatorResults: z.record(
    z.string(),
    z.object({
      valid: z.boolean(),
      issues: z.array(validationIssueSchema),
    }),
  ),
});

type ValidationResult = z.infer<typeof validationResultSchema>;

const validatorContextSchema = z.object({
  worktreePath: z.string(),
  files: z.array(z.string()),
  staged: z.boolean().default(false),
});

type ValidatorContext = z.infer<typeof validatorContextSchema>;

export type { ValidationIssueSeverity, ValidationIssue, ValidationResult, ValidatorContext };

export { validationIssueSeveritySchema, validationIssueSchema, validationResultSchema, validatorContextSchema };
