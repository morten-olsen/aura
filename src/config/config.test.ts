import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { loadConfig } from './config.ts';

describe('loadConfig', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aura-config-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('loads config with default values when no config dir provided', () => {
    const config = loadConfig();

    assert.strictEqual(config.env, 'development');
    assert.strictEqual(config.server.port, 4000);
    assert.strictEqual(config.database.client, 'better-sqlite3');
  });

  it('loads config from existing files only', () => {
    // Create only local.json, not default.json or development.json
    const localConfig = {
      server: {
        port: 5000,
      },
    };
    fs.writeFileSync(path.join(tempDir, 'local.json'), JSON.stringify(localConfig));

    const config = loadConfig(tempDir);

    // Should use value from local.json
    assert.strictEqual(config.server.port, 5000);
    // Should use default for other values
    assert.strictEqual(config.env, 'development');
  });

  it('does not throw when config files do not exist', () => {
    // Empty directory - no config files
    assert.doesNotThrow(() => {
      loadConfig(tempDir);
    });
  });

  it('merges multiple config files in correct order', () => {
    // Create default.json
    fs.writeFileSync(
      path.join(tempDir, 'default.json'),
      JSON.stringify({
        server: { port: 3000, host: 'default-host' },
      }),
    );

    // Create local.json (should override default)
    fs.writeFileSync(
      path.join(tempDir, 'local.json'),
      JSON.stringify({
        server: { port: 6000 },
      }),
    );

    const config = loadConfig(tempDir);

    // local.json should override default.json
    assert.strictEqual(config.server.port, 6000);
  });
});
