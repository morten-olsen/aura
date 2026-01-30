import { z } from 'zod';

const synthResultSchema = z.object({
  success: z.boolean(),
  outputDir: z.string(),
  manifests: z.array(z.string()),
  errors: z.array(z.string()),
});

type SynthResult = z.infer<typeof synthResultSchema>;

const cdk8sValidationIssueSchema = z.object({
  severity: z.enum(['error', 'warning', 'info']),
  message: z.string(),
  resource: z.string().optional(),
  field: z.string().optional(),
});

type Cdk8sValidationIssue = z.infer<typeof cdk8sValidationIssueSchema>;

const cdk8sValidationResultSchema = z.object({
  valid: z.boolean(),
  issues: z.array(cdk8sValidationIssueSchema),
  manifestPath: z.string(),
});

type Cdk8sValidationResult = z.infer<typeof cdk8sValidationResultSchema>;

const diffResultSchema = z.object({
  hasChanges: z.boolean(),
  added: z.array(z.string()),
  modified: z.array(z.string()),
  removed: z.array(z.string()),
  diff: z.string(),
});

type DiffResult = z.infer<typeof diffResultSchema>;

export type { SynthResult, Cdk8sValidationIssue, Cdk8sValidationResult, DiffResult };

export { synthResultSchema, cdk8sValidationIssueSchema, cdk8sValidationResultSchema, diffResultSchema };
