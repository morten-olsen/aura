import { z } from 'zod';
import { DynamicStructuredTool } from '@langchain/core/tools';

import type { ValidationService } from '#root/validation/validation.ts';
import type { GitService } from '#root/git/git.ts';

const createValidationTools = (
  validationService: ValidationService,
  gitService: GitService,
  ticketId: string,
): DynamicStructuredTool[] => {
  const validateFilesTool = new DynamicStructuredTool({
    name: 'validate_files',
    description:
      'Run validation checks on specified files. Returns validation results including any errors or warnings.',
    schema: z.object({
      files: z.array(z.string()).describe('Array of file paths relative to worktree to validate'),
      staged: z.boolean().optional().describe('Whether to validate staged changes only'),
    }),
    func: async ({ files, staged }) => {
      const worktreePath = gitService.getWorktreePath(ticketId);
      const result = await validationService.validateFiles(worktreePath, files, {
        staged: staged ?? false,
        ticketId,
      });
      return JSON.stringify(result, null, 2);
    },
  });

  const listValidatorsTool = new DynamicStructuredTool({
    name: 'list_validators',
    description: 'List all registered validators and their names.',
    schema: z.object({}),
    func: async () => {
      const validators = validationService.getValidators();
      return JSON.stringify(
        validators.map((v) => v.name),
        null,
        2,
      );
    },
  });

  return [validateFilesTool, listValidatorsTool];
};

export { createValidationTools };
