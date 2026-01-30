import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

import { ValidationService } from './validation.ts';

describe('ValidationService', () => {
  let service: ValidationService;
  let tempDir: string;

  beforeEach(async () => {
    service = new ValidationService();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'validation-test-'));
  });

  describe('constructor', () => {
    it('registers default validators', () => {
      const validators = service.getValidators();
      assert.ok(validators.some((v) => v.name === 'schema'));
      assert.ok(validators.some((v) => v.name === 'lint'));
      assert.ok(validators.some((v) => v.name === 'secrets'));
    });
  });

  describe('registerValidator', () => {
    it('registers a new validator', () => {
      service.registerValidator({
        name: 'custom',
        validate: async () => [],
      });

      const validators = service.getValidators();
      assert.ok(validators.some((v) => v.name === 'custom'));
    });

    it('replaces validator with same name', () => {
      const firstValidator = {
        name: 'custom',
        validate: async () => [{ severity: 'error' as const, message: 'first' }],
      };
      const secondValidator = {
        name: 'custom',
        validate: async () => [{ severity: 'warning' as const, message: 'second' }],
      };

      service.registerValidator(firstValidator);
      service.registerValidator(secondValidator);

      const validators = service.getValidators();
      const customValidators = validators.filter((v) => v.name === 'custom');
      assert.strictEqual(customValidators.length, 1);
    });
  });

  describe('unregisterValidator', () => {
    it('removes a validator', () => {
      const removed = service.unregisterValidator('schema');
      assert.strictEqual(removed, true);

      const validators = service.getValidators();
      assert.ok(!validators.some((v) => v.name === 'schema'));
    });

    it('returns false for non-existent validator', () => {
      const removed = service.unregisterValidator('non-existent');
      assert.strictEqual(removed, false);
    });
  });

  describe('validate', () => {
    it('returns valid result for empty file list', async () => {
      const result = await service.validate({
        worktreePath: tempDir,
        files: [],
        staged: false,
      });

      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.issues.length, 0);
    });

    it('detects YAML formatting issues', async () => {
      const yamlPath = path.join(tempDir, 'test.yaml');
      await fs.writeFile(yamlPath, 'key:\tvalue\n');

      const result = await service.validate({
        worktreePath: tempDir,
        files: ['test.yaml'],
        staged: false,
      });

      assert.ok(result.issues.some((i) => i.rule === 'no-tabs' || i.rule === 'indent-style'));
    });

    it('detects potential secrets', async () => {
      const filePath = path.join(tempDir, 'config.yaml');
      await fs.writeFile(filePath, 'api_key: sk-1234567890abcdefghijklmnop\n');

      const result = await service.validate({
        worktreePath: tempDir,
        files: ['config.yaml'],
        staged: false,
      });

      assert.ok(result.issues.some((i) => i.rule?.includes('secret')));
    });

    it('ignores binary files for secrets detection', async () => {
      const filePath = path.join(tempDir, 'image.png');
      await fs.writeFile(filePath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));

      const result = await service.validate({
        worktreePath: tempDir,
        files: ['image.png'],
        staged: false,
      });

      assert.strictEqual(result.valid, true);
    });
  });

  describe('validateFiles', () => {
    it('is a convenience wrapper for validate', async () => {
      const result = await service.validateFiles(tempDir, []);
      assert.strictEqual(result.valid, true);
    });
  });

  describe('setAuditService', () => {
    it('sets the audit service without errors', () => {
      const mockAuditService = {
        log: mock.fn(() => Promise.resolve({})),
      };
      assert.doesNotThrow(() => service.setAuditService(mockAuditService as never));
    });
  });
});
