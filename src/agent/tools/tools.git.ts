import { z } from 'zod';
import { DynamicStructuredTool } from '@langchain/core/tools';

import type { GitService } from '#root/git/git.ts';

const createGitTools = (gitService: GitService, ticketId: string): DynamicStructuredTool[] => {
  const readFileTool = new DynamicStructuredTool({
    name: 'git_read_file',
    description: 'Read a file from the worktree. Returns the file content as a string.',
    schema: z.object({
      path: z.string().describe('File path relative to worktree root'),
    }),
    func: async ({ path }) => {
      const content = await gitService.readFile(ticketId, path);
      return content;
    },
  });

  const writeFileTool = new DynamicStructuredTool({
    name: 'git_write_file',
    description: 'Write content to a file in the worktree. Creates parent directories if needed.',
    schema: z.object({
      path: z.string().describe('File path relative to worktree root'),
      content: z.string().describe('File content to write'),
    }),
    func: async ({ path, content }) => {
      await gitService.writeFile(ticketId, path, content);
      return `File written successfully: ${path}`;
    },
  });

  const deleteFileTool = new DynamicStructuredTool({
    name: 'git_delete_file',
    description: 'Delete a file from the worktree.',
    schema: z.object({
      path: z.string().describe('File path relative to worktree root'),
    }),
    func: async ({ path }) => {
      await gitService.deleteFile(ticketId, path);
      return `File deleted successfully: ${path}`;
    },
  });

  const statusTool = new DynamicStructuredTool({
    name: 'git_status',
    description: 'Get the git status of the worktree, including staged, modified, and untracked files.',
    schema: z.object({}),
    func: async () => {
      const status = await gitService.status(ticketId);
      return JSON.stringify(status, null, 2);
    },
  });

  const diffTool = new DynamicStructuredTool({
    name: 'git_diff',
    description: 'Get the diff of changes in the worktree. Optionally compare against a base ref.',
    schema: z.object({
      base: z.string().optional().describe('Base ref to compare against (e.g., "main", "HEAD~1")'),
    }),
    func: async ({ base }) => {
      const diff = await gitService.diff(ticketId, base);
      return diff || 'No changes';
    },
  });

  const stageTool = new DynamicStructuredTool({
    name: 'git_stage',
    description: 'Stage files for commit.',
    schema: z.object({
      files: z.array(z.string()).describe('Array of file paths to stage, or ["."] to stage all'),
    }),
    func: async ({ files }) => {
      await gitService.stage(ticketId, files);
      return `Staged files: ${files.join(', ')}`;
    },
  });

  const commitTool = new DynamicStructuredTool({
    name: 'git_commit',
    description: 'Create a commit with staged changes.',
    schema: z.object({
      message: z.string().describe('Commit message'),
    }),
    func: async ({ message }) => {
      const result = await gitService.commit(ticketId, message);
      return `Commit created: ${result.sha.substring(0, 7)} - ${result.message}`;
    },
  });

  const pushTool = new DynamicStructuredTool({
    name: 'git_push',
    description: 'Push committed changes to the remote repository.',
    schema: z.object({}),
    func: async () => {
      await gitService.push(ticketId);
      return 'Changes pushed successfully';
    },
  });

  return [readFileTool, writeFileTool, deleteFileTool, statusTool, diffTool, stageTool, commitTool, pushTool];
};

export { createGitTools };
