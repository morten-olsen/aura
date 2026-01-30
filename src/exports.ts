export type { AuraConfig } from '#root/config/config.ts';
export { config, loadConfig } from '#root/config/config.ts';

export type { ServiceFactoryFn, DestroyFn } from '#root/services/services.ts';
export { ServiceContainer } from '#root/services/services.ts';

export type {
  TicketStatus,
  TicketPriority,
  TokenUsage,
  PendingApproval,
  PendingQuestion,
  CommitInfo,
  AuditEventType,
  Actor,
  ToolCallInfo,
  StateChange,
  AgentPhase,
  KnowledgeType,
} from '#root/database/database.schemas.ts';

export {
  ticketStatusSchema,
  ticketPrioritySchema,
  tokenUsageSchema,
  pendingApprovalSchema,
  pendingQuestionSchema,
  commitInfoSchema,
  auditEventTypeSchema,
  actorSchema,
  toolCallInfoSchema,
  stateChangeSchema,
  agentPhaseSchema,
  knowledgeTypeSchema,
} from '#root/database/database.schemas.ts';

export { createDatabase, runMigrations, registerDatabase } from '#root/database/database.ts';

export type {
  Ticket,
  CreateTicketInput,
  UpdateTicketInput,
  ApproveTicketInput,
  AnswerQuestionInput,
} from '#root/tickets/tickets.schemas.ts';

export {
  ticketSchema,
  createTicketInputSchema,
  updateTicketInputSchema,
  approveTicketInputSchema,
  answerQuestionInputSchema,
} from '#root/tickets/tickets.schemas.ts';

export {
  TicketError,
  TicketNotFoundError,
  InvalidStatusTransitionError,
  NoPendingApprovalError,
  NoPendingQuestionError,
  NoPlanError,
} from '#root/tickets/tickets.errors.ts';

export { TicketService, registerTicketService } from '#root/tickets/tickets.ts';

export type { AuditLogEntry, CreateAuditLogInput, AuditLogQuery } from '#root/audit/audit.schemas.ts';

export { auditLogEntrySchema, createAuditLogInputSchema, auditLogQuerySchema } from '#root/audit/audit.schemas.ts';

export { AuditService, registerAuditService } from '#root/audit/audit.ts';

export type { ServerConfig } from '#root/server/server.ts';
export { createServer, startServer } from '#root/server/server.ts';

// Git
export type { GitConfig } from '#root/git/git.ts';
export { GitService, registerGitService } from '#root/git/git.ts';

export type { GitFileChange, GitStatus, GitCommitResult, WorktreeInfo } from '#root/git/git.schemas.ts';

export {
  gitFileChangeSchema,
  gitStatusSchema,
  gitCommitResultSchema,
  worktreeInfoSchema,
} from '#root/git/git.schemas.ts';

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
} from '#root/git/git.errors.ts';

// Validation
export type { Validator } from '#root/validation/validation.ts';
export { ValidationService, registerValidationService } from '#root/validation/validation.ts';

export type {
  ValidationIssueSeverity,
  ValidationIssue,
  ValidationResult,
  ValidatorContext,
} from '#root/validation/validation.schemas.ts';

export {
  validationIssueSeveritySchema,
  validationIssueSchema,
  validationResultSchema,
  validatorContextSchema,
} from '#root/validation/validation.schemas.ts';

export { ValidationError, ValidatorNotFoundError, ValidationFailedError } from '#root/validation/validation.errors.ts';

export { createSchemaValidator } from '#root/validation/validators/schema.ts';
export { createLintValidator } from '#root/validation/validators/lint.ts';
export { createSecretsValidator } from '#root/validation/validators/secrets.ts';

// CDK8s
export { Cdk8sService, registerCdk8sService } from '#root/cdk8s/cdk8s.ts';

export type {
  SynthResult,
  Cdk8sValidationIssue,
  Cdk8sValidationResult,
  DiffResult,
} from '#root/cdk8s/cdk8s.schemas.ts';

export {
  synthResultSchema,
  cdk8sValidationIssueSchema,
  cdk8sValidationResultSchema,
  diffResultSchema,
} from '#root/cdk8s/cdk8s.schemas.ts';

export {
  Cdk8sError,
  SynthFailedError,
  ManifestNotFoundError,
  InvalidManifestError,
  Cdk8sNotInstalledError,
} from '#root/cdk8s/cdk8s.errors.ts';

// Agent
export type { AgentServiceDeps } from '#root/agent/agent.ts';
export { AgentService, registerAgentService } from '#root/agent/agent.ts';

export type {
  MessageRole,
  ToolCall,
  Message,
  AgentState,
  ToolResult,
  AgentRunResult,
  HumanInput,
} from '#root/agent/agent.schemas.ts';

export {
  messageRoleSchema,
  toolCallSchema,
  messageSchema,
  agentStateSchema,
  toolResultSchema,
  agentRunResultSchema,
  humanInputSchema,
} from '#root/agent/agent.schemas.ts';

export {
  AgentError,
  MaxTurnsExceededError,
  PlanNotApprovedError,
  ToolExecutionError,
  LLMError,
  AgentNotRunningError,
} from '#root/agent/agent.errors.ts';

export { DatabaseCheckpointer } from '#root/agent/agent.checkpointer.ts';

export type { ToolDependencies } from '#root/agent/tools/tools.ts';
export { createAllTools, createGitTools, createValidationTools, createHumanTools } from '#root/agent/tools/tools.ts';
