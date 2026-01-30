import { z } from 'zod';

const gitFileChangeSchema = z.object({
  path: z.string(),
  index: z.string(),
  workingDir: z.string(),
});

type GitFileChange = z.infer<typeof gitFileChangeSchema>;

const gitStatusSchema = z.object({
  current: z.string().nullable(),
  tracking: z.string().nullable(),
  staged: z.array(gitFileChangeSchema),
  modified: z.array(gitFileChangeSchema),
  deleted: z.array(gitFileChangeSchema),
  created: z.array(gitFileChangeSchema),
  conflicted: z.array(z.string()),
  ahead: z.number(),
  behind: z.number(),
});

type GitStatus = z.infer<typeof gitStatusSchema>;

const gitCommitResultSchema = z.object({
  sha: z.string(),
  message: z.string(),
  author: z.object({
    name: z.string(),
    email: z.string(),
  }),
  timestamp: z.string(),
});

type GitCommitResult = z.infer<typeof gitCommitResultSchema>;

const worktreeInfoSchema = z.object({
  ticketId: z.string(),
  path: z.string(),
  branch: z.string(),
  createdAt: z.string(),
});

type WorktreeInfo = z.infer<typeof worktreeInfoSchema>;

export type { GitFileChange, GitStatus, GitCommitResult, WorktreeInfo };

export { gitFileChangeSchema, gitStatusSchema, gitCommitResultSchema, worktreeInfoSchema };
