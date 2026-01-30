import fs from 'node:fs/promises';
import path from 'node:path';

import { simpleGit, type SimpleGit, type StatusResult, type SimpleGitOptions } from 'simple-git';

import type { GitStatus, GitCommitResult, WorktreeInfo, GitFileChange } from './git.schemas.ts';
import {
  RepositoryNotInitializedError,
  WorktreeExistsError,
  WorktreeNotFoundError,
  CommitFailedError,
  PushFailedError,
  FileNotFoundError,
} from './git.errors.ts';

import type { ServiceContainer } from '#root/services/services.ts';
import type { AuditService } from '#root/audit/audit.ts';

type GitConfig = {
  repoUrl: string;
  branch: string;
  workingDir: string;
  authorName: string;
  authorEmail: string;
};

const statusResultToGitStatus = (result: StatusResult): GitStatus => {
  const mapFileChange = (file: { path: string; index: string; working_dir: string }): GitFileChange => ({
    path: file.path,
    index: file.index,
    workingDir: file.working_dir,
  });

  return {
    current: result.current,
    tracking: result.tracking,
    staged: result.staged.map((p) => mapFileChange({ path: p, index: 'A', working_dir: ' ' })),
    modified: result.modified.map((p) => mapFileChange({ path: p, index: ' ', working_dir: 'M' })),
    deleted: result.deleted.map((p) => mapFileChange({ path: p, index: ' ', working_dir: 'D' })),
    created: result.created.map((p) => mapFileChange({ path: p, index: '?', working_dir: '?' })),
    conflicted: result.conflicted,
    ahead: result.ahead,
    behind: result.behind,
  };
};

class GitService {
  #config: GitConfig;
  #mainRepo: SimpleGit | null = null;
  #worktrees = new Map<string, { git: SimpleGit; info: WorktreeInfo }>();
  #auditService: AuditService | null = null;

  constructor(config: GitConfig) {
    this.#config = config;
  }

  setAuditService = (auditService: AuditService): void => {
    this.#auditService = auditService;
  };

  #audit = async (
    ticketId: string | null,
    type: Parameters<AuditService['log']>[0]['type'],
    action: string,
  ): Promise<void> => {
    if (this.#auditService && ticketId) {
      await this.#auditService.log({
        ticketId,
        type,
        actor: 'system',
        action,
      });
    }
  };

  #getMainRepoPath = (): string => {
    return path.resolve(this.#config.workingDir, 'repo');
  };

  #getWorktreePath = (ticketId: string): string => {
    return path.resolve(this.#config.workingDir, 'tickets', ticketId);
  };

  #getBranchName = (ticketId: string): string => {
    return `aura/ticket-${ticketId}`;
  };

  #ensureInitialized = (): SimpleGit => {
    if (!this.#mainRepo) {
      throw new RepositoryNotInitializedError();
    }
    return this.#mainRepo;
  };

  #createGitInstance = (baseDir: string): SimpleGit => {
    const options: Partial<SimpleGitOptions> = {
      baseDir,
      binary: 'git',
      maxConcurrentProcesses: 6,
    };
    return simpleGit(options);
  };

  init = async (): Promise<void> => {
    const mainRepoPath = this.#getMainRepoPath();
    const parentDir = path.dirname(mainRepoPath);
    await fs.mkdir(parentDir, { recursive: true });

    // Check if repo already exists
    let isRepo = false;
    try {
      await fs.access(mainRepoPath);
      const git = this.#createGitInstance(mainRepoPath);
      isRepo = await git.checkIsRepo();
    } catch {
      // Directory doesn't exist yet
    }

    if (!isRepo) {
      if (this.#config.repoUrl) {
        // Clone from parent directory to avoid path issues
        const git = this.#createGitInstance(parentDir);
        await git.clone(this.#config.repoUrl, mainRepoPath);
      } else {
        await fs.mkdir(mainRepoPath, { recursive: true });
        const git = this.#createGitInstance(mainRepoPath);
        await git.init();
        await git.addConfig('user.name', this.#config.authorName);
        await git.addConfig('user.email', this.#config.authorEmail);
      }
    }

    this.#mainRepo = this.#createGitInstance(mainRepoPath);
    await this.#mainRepo.addConfig('user.name', this.#config.authorName);
    await this.#mainRepo.addConfig('user.email', this.#config.authorEmail);

    const ticketsDir = path.resolve(this.#config.workingDir, 'tickets');
    await fs.mkdir(ticketsDir, { recursive: true });
  };

  getMainRepoPath = (): string => {
    return this.#getMainRepoPath();
  };

  createWorktree = async (ticketId: string): Promise<WorktreeInfo> => {
    const mainRepo = this.#ensureInitialized();

    if (this.#worktrees.has(ticketId)) {
      throw new WorktreeExistsError(ticketId);
    }

    const worktreePath = this.#getWorktreePath(ticketId);
    const branchName = this.#getBranchName(ticketId);

    const existingWorktrees = await mainRepo.raw(['worktree', 'list', '--porcelain']);
    if (existingWorktrees.includes(worktreePath)) {
      throw new WorktreeExistsError(ticketId);
    }

    await fs.mkdir(path.dirname(worktreePath), { recursive: true });

    await mainRepo.raw(['worktree', 'add', '-b', branchName, worktreePath, this.#config.branch]);

    const worktreeGit = this.#createGitInstance(worktreePath);
    await worktreeGit.addConfig('user.name', this.#config.authorName);
    await worktreeGit.addConfig('user.email', this.#config.authorEmail);

    const info: WorktreeInfo = {
      ticketId,
      path: worktreePath,
      branch: branchName,
      createdAt: new Date().toISOString(),
    };

    this.#worktrees.set(ticketId, { git: worktreeGit, info });

    await this.#audit(ticketId, 'ticket_updated', `Created worktree at ${worktreePath}`);

    return info;
  };

  getWorktree = async (ticketId: string): Promise<SimpleGit> => {
    const entry = this.#worktrees.get(ticketId);
    if (entry) {
      return entry.git;
    }

    const worktreePath = this.#getWorktreePath(ticketId);

    try {
      await fs.access(worktreePath);
    } catch {
      throw new WorktreeNotFoundError(ticketId);
    }

    const git = this.#createGitInstance(worktreePath);
    const isRepo = await git.checkIsRepo();

    if (!isRepo) {
      throw new WorktreeNotFoundError(ticketId);
    }

    const branchName = this.#getBranchName(ticketId);
    const info: WorktreeInfo = {
      ticketId,
      path: worktreePath,
      branch: branchName,
      createdAt: new Date().toISOString(),
    };

    this.#worktrees.set(ticketId, { git, info });

    return git;
  };

  getWorktreeInfo = async (ticketId: string): Promise<WorktreeInfo> => {
    const entry = this.#worktrees.get(ticketId);
    if (entry) {
      return entry.info;
    }

    await this.getWorktree(ticketId);
    const newEntry = this.#worktrees.get(ticketId);
    if (!newEntry) {
      throw new WorktreeNotFoundError(ticketId);
    }
    return newEntry.info;
  };

  getWorktreePath = (ticketId: string): string => {
    return this.#getWorktreePath(ticketId);
  };

  removeWorktree = async (ticketId: string): Promise<void> => {
    const mainRepo = this.#ensureInitialized();

    const worktreePath = this.#getWorktreePath(ticketId);
    const branchName = this.#getBranchName(ticketId);

    try {
      await mainRepo.raw(['worktree', 'remove', worktreePath, '--force']);
    } catch {
      try {
        await fs.rm(worktreePath, { recursive: true, force: true });
        await mainRepo.raw(['worktree', 'prune']);
      } catch {
        // Worktree might not exist, continue to cleanup
      }
    }

    try {
      await mainRepo.deleteLocalBranch(branchName, true);
    } catch {
      // Branch might not exist
    }

    this.#worktrees.delete(ticketId);
  };

  createBranch = async (ticketId: string): Promise<string> => {
    const git = await this.getWorktree(ticketId);
    const branchName = this.#getBranchName(ticketId);

    const currentBranch = await git.revparse(['--abbrev-ref', 'HEAD']);
    if (currentBranch.trim() === branchName) {
      return branchName;
    }

    await git.checkout(branchName);

    return branchName;
  };

  readFile = async (ticketId: string, filePath: string): Promise<string> => {
    const worktreePath = this.#getWorktreePath(ticketId);
    const fullPath = path.join(worktreePath, filePath);

    try {
      const content = await fs.readFile(fullPath, 'utf-8');
      return content;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new FileNotFoundError(filePath);
      }
      throw error;
    }
  };

  writeFile = async (ticketId: string, filePath: string, content: string): Promise<void> => {
    const worktreePath = this.#getWorktreePath(ticketId);
    const fullPath = path.join(worktreePath, filePath);

    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content, 'utf-8');
  };

  deleteFile = async (ticketId: string, filePath: string): Promise<void> => {
    const worktreePath = this.#getWorktreePath(ticketId);
    const fullPath = path.join(worktreePath, filePath);

    try {
      await fs.unlink(fullPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new FileNotFoundError(filePath);
      }
      throw error;
    }
  };

  stage = async (ticketId: string, files: string[]): Promise<void> => {
    const git = await this.getWorktree(ticketId);
    await git.add(files);
  };

  commit = async (ticketId: string, message: string): Promise<GitCommitResult> => {
    const git = await this.getWorktree(ticketId);

    try {
      const result = await git.commit(message);

      if (!result.commit) {
        throw new CommitFailedError('No changes to commit');
      }

      const commitResult: GitCommitResult = {
        sha: result.commit,
        message,
        author: {
          name: this.#config.authorName,
          email: this.#config.authorEmail,
        },
        timestamp: new Date().toISOString(),
      };

      await this.#audit(ticketId, 'commit_created', `Created commit ${result.commit.substring(0, 7)}: ${message}`);

      return commitResult;
    } catch (error) {
      if (error instanceof CommitFailedError) {
        throw error;
      }
      throw new CommitFailedError((error as Error).message);
    }
  };

  push = async (ticketId: string): Promise<void> => {
    const git = await this.getWorktree(ticketId);
    const branchName = this.#getBranchName(ticketId);

    try {
      await git.push('origin', branchName, ['--set-upstream']);
      await this.#audit(ticketId, 'ticket_updated', `Pushed branch ${branchName} to origin`);
    } catch (error) {
      throw new PushFailedError((error as Error).message);
    }
  };

  status = async (ticketId: string): Promise<GitStatus> => {
    const git = await this.getWorktree(ticketId);
    const result = await git.status();
    return statusResultToGitStatus(result);
  };

  diff = async (ticketId: string, base?: string): Promise<string> => {
    const git = await this.getWorktree(ticketId);

    if (base) {
      return git.diff([base, 'HEAD']);
    }

    return git.diff();
  };

  listWorktrees = async (): Promise<WorktreeInfo[]> => {
    const mainRepo = this.#ensureInitialized();

    const result = await mainRepo.raw(['worktree', 'list', '--porcelain']);
    const worktrees: WorktreeInfo[] = [];

    const entries = result.split('\n\n').filter(Boolean);

    for (const entry of entries) {
      const lines = entry.split('\n');
      const worktreeLine = lines.find((l) => l.startsWith('worktree '));
      const branchLine = lines.find((l) => l.startsWith('branch '));

      if (worktreeLine && branchLine) {
        const worktreePath = worktreeLine.replace('worktree ', '');
        const branch = branchLine.replace('branch refs/heads/', '');

        const match = branch.match(/^aura\/ticket-(.+)$/);
        if (match && match[1]) {
          worktrees.push({
            ticketId: match[1],
            path: worktreePath,
            branch,
            createdAt: new Date().toISOString(),
          });
        }
      }
    }

    return worktrees;
  };

  checkout = async (ticketId: string, ref: string): Promise<void> => {
    const git = await this.getWorktree(ticketId);
    await git.checkout(ref);
  };

  fetch = async (ticketId?: string): Promise<void> => {
    if (ticketId) {
      const git = await this.getWorktree(ticketId);
      await git.fetch();
    } else {
      const mainRepo = this.#ensureInitialized();
      await mainRepo.fetch();
    }
  };

  pull = async (ticketId: string): Promise<void> => {
    const git = await this.getWorktree(ticketId);
    await git.pull();
  };
}

const registerGitService = (container: ServiceContainer): void => {
  container.register(
    'git',
    async (c) => {
      const service = new GitService({
        repoUrl: c.config.git.repoUrl,
        branch: c.config.git.branch,
        workingDir: c.config.git.workingDir,
        authorName: c.config.git.authorName,
        authorEmail: c.config.git.authorEmail,
      });

      if (c.has('audit')) {
        const auditService = await c.resolve<AuditService>('audit');
        service.setAuditService(auditService);
      }

      await service.init();

      return service;
    },
    async () => {
      // Cleanup handled by removing worktrees if needed
    },
  );
};

export type { GitConfig };
export { GitService, registerGitService };
