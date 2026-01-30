import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';

import type { SynthResult, Cdk8sValidationResult, Cdk8sValidationIssue, DiffResult } from './cdk8s.schemas.ts';
import {
  SynthFailedError,
  ManifestNotFoundError,
  InvalidManifestError,
  Cdk8sNotInstalledError,
} from './cdk8s.errors.ts';

import type { ServiceContainer } from '#root/services/services.ts';

const execAsync = promisify(exec);

const REQUIRED_K8S_FIELDS = ['apiVersion', 'kind', 'metadata'];

class Cdk8sService {
  #cdk8sAvailable: boolean | null = null;

  #checkCdk8sAvailable = async (): Promise<boolean> => {
    if (this.#cdk8sAvailable !== null) {
      return this.#cdk8sAvailable;
    }

    try {
      await execAsync('cdk8s --version');
      this.#cdk8sAvailable = true;
      return true;
    } catch {
      this.#cdk8sAvailable = false;
      return false;
    }
  };

  #ensureCdk8sAvailable = async (): Promise<void> => {
    const available = await this.#checkCdk8sAvailable();
    if (!available) {
      throw new Cdk8sNotInstalledError();
    }
  };

  synth = async (worktreePath: string): Promise<SynthResult> => {
    await this.#ensureCdk8sAvailable();

    const outputDir = path.join(worktreePath, 'dist');
    const errors: string[] = [];
    const manifests: string[] = [];

    try {
      await execAsync('cdk8s synth', {
        cwd: worktreePath,
        env: { ...process.env, CDK8S_OUTDIR: outputDir },
      });

      try {
        const files = await fs.readdir(outputDir);
        for (const file of files) {
          if (file.endsWith('.yaml') || file.endsWith('.yml') || file.endsWith('.json')) {
            manifests.push(path.join(outputDir, file));
          }
        }
      } catch {
        // Output dir might not exist if there were no charts
      }

      return {
        success: true,
        outputDir,
        manifests,
        errors,
      };
    } catch (error) {
      const execError = error as { stderr?: string; message?: string };
      const errorMessage = execError.stderr || execError.message || 'Unknown error';
      errors.push(errorMessage);

      throw new SynthFailedError(errorMessage);
    }
  };

  validate = async (manifestPath: string): Promise<Cdk8sValidationResult> => {
    const issues: Cdk8sValidationIssue[] = [];

    try {
      await fs.access(manifestPath);
    } catch {
      throw new ManifestNotFoundError(manifestPath);
    }

    const content = await fs.readFile(manifestPath, 'utf-8');

    const ext = path.extname(manifestPath).toLowerCase();
    if (ext === '.json') {
      try {
        const parsed = JSON.parse(content);
        issues.push(...this.#validateK8sObject(parsed));
      } catch (error) {
        throw new InvalidManifestError(manifestPath, `Invalid JSON: ${(error as Error).message}`);
      }
    } else {
      const documents = content.split(/^---$/m).filter((doc) => doc.trim());

      for (const doc of documents) {
        const yamlIssues = this.#validateYamlDocument(doc);
        issues.push(...yamlIssues);
      }
    }

    const hasErrors = issues.some((issue) => issue.severity === 'error');

    return {
      valid: !hasErrors,
      issues,
      manifestPath,
    };
  };

  #validateYamlDocument = (doc: string): Cdk8sValidationIssue[] => {
    const issues: Cdk8sValidationIssue[] = [];

    if (!doc.trim()) {
      return issues;
    }

    for (const field of REQUIRED_K8S_FIELDS) {
      const fieldPattern = new RegExp(`^${field}:`, 'm');
      if (!fieldPattern.test(doc)) {
        issues.push({
          severity: 'error',
          message: `Missing required field: ${field}`,
          field,
        });
      }
    }

    const kindMatch = doc.match(/^kind:\s*(.+)$/m);
    if (kindMatch && kindMatch[1]) {
      const kind = kindMatch[1].trim();

      const namespacePattern = /^metadata:[\s\S]*?namespace:/m;
      const isNamespaced = this.#isNamespacedResource(kind);

      if (isNamespaced && !namespacePattern.test(doc)) {
        issues.push({
          severity: 'warning',
          message: `Namespaced resource "${kind}" should specify a namespace`,
          resource: kind,
          field: 'metadata.namespace',
        });
      }
    }

    const apiVersionMatch = doc.match(/^apiVersion:\s*(.+)$/m);
    if (apiVersionMatch && apiVersionMatch[1]) {
      const apiVersion = apiVersionMatch[1].trim();
      if (apiVersion.includes('v1beta') || apiVersion.includes('v1alpha')) {
        issues.push({
          severity: 'warning',
          message: `Using potentially unstable API version: ${apiVersion}`,
          field: 'apiVersion',
        });
      }
    }

    return issues;
  };

  #validateK8sObject = (obj: unknown): Cdk8sValidationIssue[] => {
    const issues: Cdk8sValidationIssue[] = [];

    if (typeof obj !== 'object' || obj === null) {
      issues.push({
        severity: 'error',
        message: 'Manifest must be an object',
      });
      return issues;
    }

    const manifest = obj as Record<string, unknown>;

    for (const field of REQUIRED_K8S_FIELDS) {
      if (!(field in manifest)) {
        issues.push({
          severity: 'error',
          message: `Missing required field: ${field}`,
          field,
        });
      }
    }

    if (typeof manifest.kind === 'string') {
      const kind = manifest.kind;
      const metadata = manifest.metadata as Record<string, unknown> | undefined;

      if (this.#isNamespacedResource(kind) && (!metadata || !metadata.namespace)) {
        issues.push({
          severity: 'warning',
          message: `Namespaced resource "${kind}" should specify a namespace`,
          resource: kind,
          field: 'metadata.namespace',
        });
      }
    }

    if (typeof manifest.apiVersion === 'string') {
      const apiVersion = manifest.apiVersion;
      if (apiVersion.includes('v1beta') || apiVersion.includes('v1alpha')) {
        issues.push({
          severity: 'warning',
          message: `Using potentially unstable API version: ${apiVersion}`,
          field: 'apiVersion',
        });
      }
    }

    return issues;
  };

  #isNamespacedResource = (kind: string): boolean => {
    const clusterScopedKinds = [
      'Namespace',
      'Node',
      'PersistentVolume',
      'ClusterRole',
      'ClusterRoleBinding',
      'CustomResourceDefinition',
      'StorageClass',
      'PriorityClass',
      'CSIDriver',
      'CSINode',
      'VolumeAttachment',
    ];
    return !clusterScopedKinds.includes(kind);
  };

  diff = async (worktreePath: string): Promise<DiffResult> => {
    const distDir = path.join(worktreePath, 'dist');

    let distExists = false;
    try {
      await fs.access(distDir);
      distExists = true;
    } catch {
      // dist directory doesn't exist
    }

    if (!distExists) {
      return {
        hasChanges: false,
        added: [],
        modified: [],
        removed: [],
        diff: '',
      };
    }

    const currentManifests = new Map<string, string>();
    const files = await fs.readdir(distDir);

    for (const file of files) {
      if (file.endsWith('.yaml') || file.endsWith('.yml') || file.endsWith('.json')) {
        const content = await fs.readFile(path.join(distDir, file), 'utf-8');
        currentManifests.set(file, content);
      }
    }

    const added: string[] = [];
    const modified: string[] = [];
    const removed: string[] = [];
    let diffContent = '';

    for (const [file, content] of currentManifests) {
      added.push(file);
      diffContent += `+++ ${file}\n${content}\n`;
    }

    return {
      hasChanges: added.length > 0 || modified.length > 0 || removed.length > 0,
      added,
      modified,
      removed,
      diff: diffContent,
    };
  };

  isCdk8sAvailable = async (): Promise<boolean> => {
    return this.#checkCdk8sAvailable();
  };
}

const registerCdk8sService = (container: ServiceContainer): void => {
  container.register('cdk8s', async () => {
    return new Cdk8sService();
  });
};

export { Cdk8sService, registerCdk8sService };
