import { z } from 'zod';

const ticketStatusSchema = z.enum([
  'draft',
  'pending_approval',
  'approved',
  'in_progress',
  'awaiting_input',
  'paused',
  'completed',
  'failed',
  'cancelled',
]);

type TicketStatus = z.infer<typeof ticketStatusSchema>;

const ticketPrioritySchema = z.enum(['low', 'medium', 'high', 'critical']);

type TicketPriority = z.infer<typeof ticketPrioritySchema>;

const tokenUsageSchema = z.object({
  inputTokens: z.number().default(0),
  outputTokens: z.number().default(0),
  totalTokens: z.number().default(0),
});

type TokenUsage = z.infer<typeof tokenUsageSchema>;

const pendingApprovalSchema = z.object({
  type: z.enum(['plan', 'action', 'resource']),
  description: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
  requestedAt: z.string(),
});

type PendingApproval = z.infer<typeof pendingApprovalSchema>;

const pendingQuestionSchema = z.object({
  question: z.string(),
  options: z.array(z.string()).optional(),
  askedAt: z.string(),
});

type PendingQuestion = z.infer<typeof pendingQuestionSchema>;

const commitInfoSchema = z.object({
  sha: z.string(),
  message: z.string(),
  timestamp: z.string(),
});

type CommitInfo = z.infer<typeof commitInfoSchema>;

const ticketRowSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  status: ticketStatusSchema,
  priority: ticketPrioritySchema,
  created_at: z.string(),
  updated_at: z.string(),
  resolved_at: z.string().nullable(),
  plan: z.string().nullable(),
  plan_approved_at: z.string().nullable(),
  plan_approved_by: z.string().nullable(),
  current_turn: z.number(),
  max_turns: z.number(),
  token_usage: z.string(),
  pending_approval: z.string().nullable(),
  pending_question: z.string().nullable(),
  working_branch: z.string().nullable(),
  commits: z.string(),
  structured_plan: z.string().nullable(),
});

type TicketRow = z.infer<typeof ticketRowSchema>;

const auditEventTypeSchema = z.enum([
  'ticket_created',
  'ticket_updated',
  'status_changed',
  'plan_generated',
  'plan_approved',
  'plan_rejected',
  'turn_started',
  'turn_completed',
  'tool_called',
  'approval_requested',
  'approval_granted',
  'approval_denied',
  'question_asked',
  'question_answered',
  'error_occurred',
  'commit_created',
  'git_worktree_created',
  'git_commit_created',
  'git_push_completed',
  'validation_failed',
  'agent_started',
  'agent_turn_started',
  'agent_tool_called',
  'agent_completed',
]);

type AuditEventType = z.infer<typeof auditEventTypeSchema>;

const actorSchema = z.enum(['system', 'agent', 'user']);

type Actor = z.infer<typeof actorSchema>;

const toolCallInfoSchema = z.object({
  name: z.string(),
  input: z.record(z.string(), z.unknown()),
  output: z.unknown().optional(),
  duration: z.number().optional(),
});

type ToolCallInfo = z.infer<typeof toolCallInfoSchema>;

const stateChangeSchema = z.object({
  field: z.string(),
  oldValue: z.unknown(),
  newValue: z.unknown(),
});

type StateChange = z.infer<typeof stateChangeSchema>;

const auditLogRowSchema = z.object({
  id: z.string(),
  ticket_id: z.string(),
  timestamp: z.string(),
  type: auditEventTypeSchema,
  actor: actorSchema,
  action: z.string(),
  reasoning: z.string().nullable(),
  tool_call: z.string().nullable(),
  state_change: z.string().nullable(),
  token_usage: z.string().nullable(),
});

type AuditLogRow = z.infer<typeof auditLogRowSchema>;

const agentPhaseSchema = z.enum(['planning', 'executing', 'reviewing', 'waiting', 'completed']);

type AgentPhase = z.infer<typeof agentPhaseSchema>;

const agentStateRowSchema = z.object({
  ticket_id: z.string(),
  current_phase: agentPhaseSchema,
  memory: z.string(),
  pending_actions: z.string(),
  last_checkpoint: z.string(),
});

type AgentStateRow = z.infer<typeof agentStateRowSchema>;

const knowledgeTypeSchema = z.enum(['file', 'directory', 'pattern', 'convention', 'decision']);

type KnowledgeType = z.infer<typeof knowledgeTypeSchema>;

const planStepStatusSchema = z.enum(['pending', 'in_progress', 'completed', 'failed', 'skipped']);

type PlanStepStatus = z.infer<typeof planStepStatusSchema>;

const planStepSchema = z.object({
  id: z.string(),
  index: z.number(),
  title: z.string(),
  description: z.string(),
  status: planStepStatusSchema,
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  output: z.string().nullable(),
  error: z.string().nullable(),
  retryCount: z.number(),
  maxRetries: z.number(),
});

type PlanStep = z.infer<typeof planStepSchema>;

const structuredPlanSchema = z.object({
  version: z.number(),
  summary: z.string(),
  steps: z.array(planStepSchema),
  generatedAt: z.string(),
  approvedAt: z.string().nullable(),
  approvedBy: z.string().nullable(),
});

type StructuredPlan = z.infer<typeof structuredPlanSchema>;

const knowledgeEntryRowSchema = z.object({
  id: z.string(),
  path: z.string(),
  type: knowledgeTypeSchema,
  title: z.string(),
  summary: z.string().nullable(),
  last_updated: z.string(),
  updated_by_ticket: z.string().nullable(),
});

type KnowledgeEntryRow = z.infer<typeof knowledgeEntryRowSchema>;

export type {
  TicketStatus,
  TicketPriority,
  TokenUsage,
  PendingApproval,
  PendingQuestion,
  CommitInfo,
  TicketRow,
  AuditEventType,
  Actor,
  ToolCallInfo,
  StateChange,
  AuditLogRow,
  AgentPhase,
  AgentStateRow,
  KnowledgeType,
  KnowledgeEntryRow,
  PlanStepStatus,
  PlanStep,
  StructuredPlan,
};

export {
  ticketStatusSchema,
  ticketPrioritySchema,
  tokenUsageSchema,
  pendingApprovalSchema,
  pendingQuestionSchema,
  commitInfoSchema,
  ticketRowSchema,
  auditEventTypeSchema,
  actorSchema,
  toolCallInfoSchema,
  stateChangeSchema,
  auditLogRowSchema,
  agentPhaseSchema,
  agentStateRowSchema,
  knowledgeTypeSchema,
  knowledgeEntryRowSchema,
  planStepStatusSchema,
  planStepSchema,
  structuredPlanSchema,
};
