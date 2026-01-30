class Cdk8sError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'Cdk8sError';
    this.code = code;
  }
}

class SynthFailedError extends Cdk8sError {
  reason: string;

  constructor(reason: string) {
    super(`CDK8s synth failed: ${reason}`, 'SYNTH_FAILED');
    this.name = 'SynthFailedError';
    this.reason = reason;
  }
}

class ManifestNotFoundError extends Cdk8sError {
  manifestPath: string;

  constructor(manifestPath: string) {
    super(`Manifest not found: ${manifestPath}`, 'MANIFEST_NOT_FOUND');
    this.name = 'ManifestNotFoundError';
    this.manifestPath = manifestPath;
  }
}

class InvalidManifestError extends Cdk8sError {
  manifestPath: string;
  reason: string;

  constructor(manifestPath: string, reason: string) {
    super(`Invalid manifest at ${manifestPath}: ${reason}`, 'INVALID_MANIFEST');
    this.name = 'InvalidManifestError';
    this.manifestPath = manifestPath;
    this.reason = reason;
  }
}

class Cdk8sNotInstalledError extends Cdk8sError {
  constructor() {
    super('CDK8s CLI is not installed or not in PATH', 'CDK8S_NOT_INSTALLED');
    this.name = 'Cdk8sNotInstalledError';
  }
}

export { Cdk8sError, SynthFailedError, ManifestNotFoundError, InvalidManifestError, Cdk8sNotInstalledError };
