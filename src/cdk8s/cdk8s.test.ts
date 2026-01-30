import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

import { Cdk8sService } from './cdk8s.ts';
import { ManifestNotFoundError, InvalidManifestError } from './cdk8s.errors.ts';

describe('Cdk8sService', () => {
  let service: Cdk8sService;
  let tempDir: string;

  beforeEach(async () => {
    service = new Cdk8sService();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cdk8s-test-'));
  });

  describe('constructor', () => {
    it('creates a service instance', () => {
      assert.ok(service);
    });
  });

  describe('isCdk8sAvailable', () => {
    it('returns a boolean', async () => {
      const available = await service.isCdk8sAvailable();
      assert.strictEqual(typeof available, 'boolean');
    });
  });

  describe('validate', () => {
    it('throws ManifestNotFoundError for non-existent file', async () => {
      await assert.rejects(() => service.validate('/non/existent/path.yaml'), ManifestNotFoundError);
    });

    it('validates a valid YAML manifest', async () => {
      const manifestPath = path.join(tempDir, 'valid.yaml');
      await fs.writeFile(
        manifestPath,
        `apiVersion: v1
kind: ConfigMap
metadata:
  name: test-config
  namespace: default
data:
  key: value
`,
      );

      const result = await service.validate(manifestPath);
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.manifestPath, manifestPath);
    });

    it('detects missing required fields', async () => {
      const manifestPath = path.join(tempDir, 'invalid.yaml');
      await fs.writeFile(
        manifestPath,
        `name: test
data:
  key: value
`,
      );

      const result = await service.validate(manifestPath);
      assert.strictEqual(result.valid, false);
      assert.ok(result.issues.some((i) => i.message.includes('apiVersion')));
      assert.ok(result.issues.some((i) => i.message.includes('kind')));
      assert.ok(result.issues.some((i) => i.message.includes('metadata')));
    });

    it('warns about missing namespace for namespaced resources', async () => {
      const manifestPath = path.join(tempDir, 'no-ns.yaml');
      await fs.writeFile(
        manifestPath,
        `apiVersion: v1
kind: Pod
metadata:
  name: test-pod
spec:
  containers: []
`,
      );

      const result = await service.validate(manifestPath);
      assert.ok(result.issues.some((i) => i.message.includes('namespace')));
    });

    it('does not warn about namespace for cluster-scoped resources', async () => {
      const manifestPath = path.join(tempDir, 'cluster-scoped.yaml');
      await fs.writeFile(
        manifestPath,
        `apiVersion: v1
kind: Namespace
metadata:
  name: test-namespace
`,
      );

      const result = await service.validate(manifestPath);
      assert.ok(!result.issues.some((i) => i.message.includes('should specify a namespace')));
    });

    it('warns about unstable API versions', async () => {
      const manifestPath = path.join(tempDir, 'beta.yaml');
      await fs.writeFile(
        manifestPath,
        `apiVersion: apps/v1beta1
kind: Deployment
metadata:
  name: test
  namespace: default
`,
      );

      const result = await service.validate(manifestPath);
      assert.ok(result.issues.some((i) => i.message.includes('unstable')));
    });

    it('validates JSON manifests', async () => {
      const manifestPath = path.join(tempDir, 'valid.json');
      await fs.writeFile(
        manifestPath,
        JSON.stringify({
          apiVersion: 'v1',
          kind: 'ConfigMap',
          metadata: {
            name: 'test',
            namespace: 'default',
          },
        }),
      );

      const result = await service.validate(manifestPath);
      assert.strictEqual(result.valid, true);
    });

    it('throws InvalidManifestError for invalid JSON', async () => {
      const manifestPath = path.join(tempDir, 'invalid.json');
      await fs.writeFile(manifestPath, '{ invalid json }');

      await assert.rejects(() => service.validate(manifestPath), InvalidManifestError);
    });

    it('handles multi-document YAML', async () => {
      const manifestPath = path.join(tempDir, 'multi.yaml');
      await fs.writeFile(
        manifestPath,
        `apiVersion: v1
kind: ConfigMap
metadata:
  name: config1
  namespace: default
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: config2
  namespace: default
`,
      );

      const result = await service.validate(manifestPath);
      assert.strictEqual(result.valid, true);
    });
  });

  describe('diff', () => {
    it('returns empty diff when dist directory does not exist', async () => {
      const result = await service.diff(tempDir);
      assert.strictEqual(result.hasChanges, false);
      assert.strictEqual(result.added.length, 0);
      assert.strictEqual(result.modified.length, 0);
      assert.strictEqual(result.removed.length, 0);
    });

    it('detects added files in dist directory', async () => {
      const distDir = path.join(tempDir, 'dist');
      await fs.mkdir(distDir);
      await fs.writeFile(path.join(distDir, 'manifest.yaml'), 'apiVersion: v1\n');

      const result = await service.diff(tempDir);
      assert.strictEqual(result.hasChanges, true);
      assert.ok(result.added.includes('manifest.yaml'));
    });
  });
});
