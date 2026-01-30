import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { GitService } from './git.ts';
import { RepositoryNotInitializedError, WorktreeNotFoundError } from './git.errors.ts';

const createMockConfig = () => ({
  repoUrl: '',
  branch: 'main',
  workingDir: '/tmp/test-workspace',
  authorName: 'Test Author',
  authorEmail: 'test@example.com',
});

describe('GitService', () => {
  let service: GitService;

  beforeEach(() => {
    service = new GitService(createMockConfig());
  });

  describe('constructor', () => {
    it('creates a service instance', () => {
      assert.ok(service);
    });
  });

  describe('getMainRepoPath', () => {
    it('returns the main repo path', () => {
      const path = service.getMainRepoPath();
      assert.ok(path.includes('repo'));
    });
  });

  describe('getWorktreePath', () => {
    it('returns the worktree path for a ticket', () => {
      const path = service.getWorktreePath('ticket-123');
      assert.ok(path.includes('tickets'));
      assert.ok(path.includes('ticket-123'));
    });
  });

  describe('createWorktree (before init)', () => {
    it('throws RepositoryNotInitializedError when not initialized', async () => {
      await assert.rejects(() => service.createWorktree('ticket-123'), RepositoryNotInitializedError);
    });
  });

  describe('getWorktree (before init)', () => {
    it('throws WorktreeNotFoundError when worktree does not exist', async () => {
      await assert.rejects(() => service.getWorktree('non-existent'), WorktreeNotFoundError);
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

describe('GitService init', () => {
  let tempDir: string;
  let service: GitService;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aura-git-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('initializes an empty git repo when no repoUrl is provided', async () => {
    service = new GitService({
      repoUrl: '',
      branch: 'main',
      workingDir: tempDir,
      authorName: 'Test Author',
      authorEmail: 'test@example.com',
    });

    await service.init();

    // Verify repo directory was created
    const repoPath = service.getMainRepoPath();
    assert.ok(fs.existsSync(repoPath), 'Repo path should exist');

    // Verify .git directory exists (indicating a git repo)
    assert.ok(fs.existsSync(path.join(repoPath, '.git')), '.git directory should exist');

    // Verify tickets directory was created
    const ticketsDir = path.join(tempDir, 'tickets');
    assert.ok(fs.existsSync(ticketsDir), 'Tickets directory should exist');
  });

  it('does not re-initialize an existing repo', async () => {
    service = new GitService({
      repoUrl: '',
      branch: 'main',
      workingDir: tempDir,
      authorName: 'Test Author',
      authorEmail: 'test@example.com',
    });

    // Initialize twice
    await service.init();
    await service.init();

    // Should not throw and repo should still exist
    const repoPath = service.getMainRepoPath();
    assert.ok(fs.existsSync(repoPath));
  });
});
