class GitError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'GitError';
    this.code = code;
  }
}

class RepositoryNotFoundError extends GitError {
  constructor(path: string) {
    super(`Repository not found at: ${path}`, 'REPOSITORY_NOT_FOUND');
    this.name = 'RepositoryNotFoundError';
  }
}

class RepositoryNotInitializedError extends GitError {
  constructor() {
    super('Repository not initialized. Call init() first.', 'REPOSITORY_NOT_INITIALIZED');
    this.name = 'RepositoryNotInitializedError';
  }
}

class WorktreeExistsError extends GitError {
  ticketId: string;

  constructor(ticketId: string) {
    super(`Worktree already exists for ticket: ${ticketId}`, 'WORKTREE_EXISTS');
    this.name = 'WorktreeExistsError';
    this.ticketId = ticketId;
  }
}

class WorktreeNotFoundError extends GitError {
  ticketId: string;

  constructor(ticketId: string) {
    super(`Worktree not found for ticket: ${ticketId}`, 'WORKTREE_NOT_FOUND');
    this.name = 'WorktreeNotFoundError';
    this.ticketId = ticketId;
  }
}

class BranchNotFoundError extends GitError {
  branch: string;

  constructor(branch: string) {
    super(`Branch not found: ${branch}`, 'BRANCH_NOT_FOUND');
    this.name = 'BranchNotFoundError';
    this.branch = branch;
  }
}

class CommitFailedError extends GitError {
  reason: string;

  constructor(reason: string) {
    super(`Commit failed: ${reason}`, 'COMMIT_FAILED');
    this.name = 'CommitFailedError';
    this.reason = reason;
  }
}

class PushFailedError extends GitError {
  reason: string;

  constructor(reason: string) {
    super(`Push failed: ${reason}`, 'PUSH_FAILED');
    this.name = 'PushFailedError';
    this.reason = reason;
  }
}

class FileNotFoundError extends GitError {
  filePath: string;

  constructor(filePath: string) {
    super(`File not found: ${filePath}`, 'FILE_NOT_FOUND');
    this.name = 'FileNotFoundError';
    this.filePath = filePath;
  }
}

export {
  GitError,
  RepositoryNotFoundError,
  RepositoryNotInitializedError,
  WorktreeExistsError,
  WorktreeNotFoundError,
  BranchNotFoundError,
  CommitFailedError,
  PushFailedError,
  FileNotFoundError,
};
