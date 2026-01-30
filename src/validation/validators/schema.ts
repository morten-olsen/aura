import fs from 'node:fs/promises';
import path from 'node:path';

import type { Validator } from '../validation.ts';
import type { ValidationIssue, ValidatorContext } from '../validation.schemas.ts';

const YAML_EXTENSIONS = ['.yaml', '.yml'];

const validateYamlStructure = (content: string, file: string): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  const lines = content.split('\n');

  let lineNumber = 0;
  for (const line of lines) {
    lineNumber++;

    if (line.includes('\t')) {
      issues.push({
        severity: 'error',
        message: 'YAML files should not contain tabs, use spaces for indentation',
        file,
        line: lineNumber,
        rule: 'no-tabs',
      });
    }

    if (/^\s*-[^\s]/.test(line) && !line.includes('---')) {
      issues.push({
        severity: 'warning',
        message: 'List items should have a space after the dash',
        file,
        line: lineNumber,
        rule: 'list-item-spacing',
      });
    }

    if (/:\S/.test(line) && !line.includes('://') && !line.includes('::')) {
      const colonMatch = line.match(/:(\S)/);
      if (colonMatch && colonMatch[1] !== ' ' && colonMatch[1] !== '\n') {
        issues.push({
          severity: 'warning',
          message: 'Key-value pairs should have a space after the colon',
          file,
          line: lineNumber,
          rule: 'key-value-spacing',
        });
      }
    }
  }

  return issues;
};

const createSchemaValidator = (): Validator => ({
  name: 'schema',
  validate: async (context: ValidatorContext): Promise<ValidationIssue[]> => {
    const issues: ValidationIssue[] = [];

    for (const file of context.files) {
      const ext = path.extname(file).toLowerCase();
      if (!YAML_EXTENSIONS.includes(ext)) {
        continue;
      }

      const fullPath = path.join(context.worktreePath, file);

      try {
        const content = await fs.readFile(fullPath, 'utf-8');
        const fileIssues = validateYamlStructure(content, file);
        issues.push(...fileIssues);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          issues.push({
            severity: 'error',
            message: `Failed to read file: ${(error as Error).message}`,
            file,
            rule: 'file-read-error',
          });
        }
      }
    }

    return issues;
  },
});

export { createSchemaValidator };
