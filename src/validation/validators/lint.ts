import fs from 'node:fs/promises';
import path from 'node:path';

import type { Validator } from '../validation.ts';
import type { ValidationIssue, ValidatorContext } from '../validation.schemas.ts';

const YAML_EXTENSIONS = ['.yaml', '.yml'];
const MAX_LINE_LENGTH = 200;

const validateYamlFormatting = (content: string, file: string): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  const lines = content.split('\n');

  let lineNumber = 0;
  for (const line of lines) {
    lineNumber++;

    if (line.length > MAX_LINE_LENGTH) {
      issues.push({
        severity: 'warning',
        message: `Line exceeds ${MAX_LINE_LENGTH} characters (${line.length})`,
        file,
        line: lineNumber,
        rule: 'max-line-length',
      });
    }

    if (line.endsWith(' ') || line.endsWith('\t')) {
      issues.push({
        severity: 'warning',
        message: 'Trailing whitespace detected',
        file,
        line: lineNumber,
        rule: 'no-trailing-whitespace',
      });
    }
  }

  if (content.length > 0 && !content.endsWith('\n')) {
    issues.push({
      severity: 'warning',
      message: 'File should end with a newline',
      file,
      line: lines.length,
      rule: 'final-newline',
    });
  }

  const indentMatch = content.match(/^(\s+)/m);
  if (indentMatch && indentMatch[1]) {
    const indent = indentMatch[1];
    if (indent.includes('\t')) {
      issues.push({
        severity: 'error',
        message: 'Use spaces for indentation, not tabs',
        file,
        rule: 'indent-style',
      });
    } else if (indent.length % 2 !== 0) {
      issues.push({
        severity: 'warning',
        message: 'Inconsistent indentation (should use 2 spaces)',
        file,
        rule: 'indent-size',
      });
    }
  }

  return issues;
};

const createLintValidator = (): Validator => ({
  name: 'lint',
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
        const fileIssues = validateYamlFormatting(content, file);
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

export { createLintValidator };
