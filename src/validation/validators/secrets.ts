import fs from 'node:fs/promises';
import path from 'node:path';

import type { Validator } from '../validation.ts';
import type { ValidationIssue, ValidatorContext } from '../validation.schemas.ts';

const SECRET_PATTERNS: { pattern: RegExp; name: string }[] = [
  { pattern: /(?:password|passwd|pwd)\s*[:=]\s*['"]?[^'"\s]{8,}['"]?/i, name: 'password' },
  { pattern: /(?:api[_-]?key|apikey)\s*[:=]\s*['"]?[A-Za-z0-9_-]{20,}['"]?/i, name: 'api-key' },
  { pattern: /(?:secret[_-]?key|secretkey)\s*[:=]\s*['"]?[A-Za-z0-9_-]{20,}['"]?/i, name: 'secret-key' },
  { pattern: /(?:access[_-]?token|accesstoken)\s*[:=]\s*['"]?[A-Za-z0-9_-]{20,}['"]?/i, name: 'access-token' },
  { pattern: /(?:auth[_-]?token|authtoken)\s*[:=]\s*['"]?[A-Za-z0-9_-]{20,}['"]?/i, name: 'auth-token' },
  { pattern: /(?:bearer)\s+[A-Za-z0-9_-]{20,}/i, name: 'bearer-token' },
  { pattern: /-----BEGIN (?:RSA |DSA |EC |OPENSSH )?PRIVATE KEY-----/i, name: 'private-key' },
  { pattern: /(?:aws[_-]?access[_-]?key[_-]?id)\s*[:=]\s*['"]?[A-Z0-9]{20}['"]?/i, name: 'aws-access-key' },
  { pattern: /(?:aws[_-]?secret[_-]?access[_-]?key)\s*[:=]\s*['"]?[A-Za-z0-9/+=]{40}['"]?/i, name: 'aws-secret-key' },
  { pattern: /ghp_[A-Za-z0-9]{36,}/, name: 'github-token' },
  { pattern: /gho_[A-Za-z0-9]{36,}/, name: 'github-oauth-token' },
  { pattern: /github_pat_[A-Za-z0-9_]{22,}/, name: 'github-pat' },
  { pattern: /sk-[A-Za-z0-9]{20,}/, name: 'openai-key' },
  { pattern: /xox[baprs]-[A-Za-z0-9-]+/, name: 'slack-token' },
];

const IGNORED_PATTERNS = [/\$\{.*\}/, /\{\{.*\}\}/, /\$[A-Z_]+/, /\bTODO\b/i, /\bXXX\b/i, /\bFIXME\b/i, /example/i];

const isLikelyFalsePositive = (line: string): boolean => {
  return IGNORED_PATTERNS.some((pattern) => pattern.test(line));
};

const detectSecrets = (content: string, file: string): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  const lines = content.split('\n');

  let lineNumber = 0;
  for (const line of lines) {
    lineNumber++;

    if (isLikelyFalsePositive(line)) {
      continue;
    }

    for (const { pattern, name } of SECRET_PATTERNS) {
      if (pattern.test(line)) {
        issues.push({
          severity: 'error',
          message: `Potential ${name} detected. Secrets should not be committed to the repository.`,
          file,
          line: lineNumber,
          rule: `secret-${name}`,
        });
        break;
      }
    }
  }

  return issues;
};

const createSecretsValidator = (): Validator => ({
  name: 'secrets',
  validate: async (context: ValidatorContext): Promise<ValidationIssue[]> => {
    const issues: ValidationIssue[] = [];

    for (const file of context.files) {
      const ext = path.extname(file).toLowerCase();

      if (['.png', '.jpg', '.jpeg', '.gif', '.ico', '.woff', '.woff2', '.ttf', '.eot'].includes(ext)) {
        continue;
      }

      const fullPath = path.join(context.worktreePath, file);

      try {
        const content = await fs.readFile(fullPath, 'utf-8');
        const fileIssues = detectSecrets(content, file);
        issues.push(...fileIssues);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          const nodeError = error as NodeJS.ErrnoException;
          if (nodeError.code !== 'EISDIR') {
            issues.push({
              severity: 'warning',
              message: `Failed to read file for secrets scan: ${(error as Error).message}`,
              file,
              rule: 'file-read-error',
            });
          }
        }
      }
    }

    return issues;
  },
});

export { createSecretsValidator };
