import type { Knex } from 'knex';

import type {
  Ticket,
  CreateTicketInput,
  UpdateTicketInput,
  ApproveTicketInput,
  AnswerQuestionInput,
} from './tickets.schemas.ts';
import {
  TicketNotFoundError,
  InvalidStatusTransitionError,
  NoPendingApprovalError,
  NoPendingQuestionError,
  NoPlanError,
} from './tickets.errors.ts';

import type { ServiceContainer } from '#root/services/services.ts';
import type {
  TicketRow,
  TicketStatus,
  TokenUsage,
  PendingApproval,
  PendingQuestion,
  CommitInfo,
  StructuredPlan,
  PlanStep,
} from '#root/database/database.schemas.ts';
import type { AuditService } from '#root/audit/audit.ts';

const VALID_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  draft: ['pending_approval', 'cancelled'],
  pending_approval: ['approved', 'draft', 'cancelled'],
  approved: ['in_progress', 'cancelled'],
  in_progress: ['awaiting_input', 'paused', 'completed', 'failed', 'cancelled'],
  awaiting_input: ['in_progress', 'paused', 'cancelled'],
  paused: ['in_progress', 'cancelled'],
  completed: [],
  failed: ['draft'],
  cancelled: ['draft'],
};

const rowToTicket = (row: TicketRow): Ticket => ({
  id: row.id,
  title: row.title,
  description: row.description,
  status: row.status,
  priority: row.priority,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  resolvedAt: row.resolved_at,
  structuredPlan: row.structured_plan ? (JSON.parse(row.structured_plan) as StructuredPlan) : null,
  currentTurn: row.current_turn,
  maxTurns: row.max_turns,
  tokenUsage: JSON.parse(row.token_usage) as TokenUsage,
  pendingApproval: row.pending_approval ? (JSON.parse(row.pending_approval) as PendingApproval) : null,
  pendingQuestion: row.pending_question ? (JSON.parse(row.pending_question) as PendingQuestion) : null,
  workingBranch: row.working_branch,
  commits: JSON.parse(row.commits) as CommitInfo[],
});

class TicketService {
  #db: Knex;
  #auditService: AuditService | null = null;
  #defaultMaxTurns: number;

  constructor(db: Knex, defaultMaxTurns: number) {
    this.#db = db;
    this.#defaultMaxTurns = defaultMaxTurns;
  }

  setAuditService = (auditService: AuditService): void => {
    this.#auditService = auditService;
  };

  #audit = async (
    ticketId: string,
    type: Parameters<AuditService['log']>[0]['type'],
    action: string,
    extra?: Partial<Parameters<AuditService['log']>[0]>,
  ): Promise<void> => {
    if (this.#auditService) {
      await this.#auditService.log({
        ticketId,
        type,
        actor: 'system',
        action,
        ...extra,
      });
    }
  };

  create = async (input: CreateTicketInput): Promise<Ticket> => {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();

    const row: TicketRow = {
      id,
      title: input.title,
      description: input.description,
      status: 'draft',
      priority: input.priority ?? 'medium',
      created_at: now,
      updated_at: now,
      resolved_at: null,
      plan: null,
      plan_approved_at: null,
      plan_approved_by: null,
      current_turn: 0,
      max_turns: input.maxTurns ?? this.#defaultMaxTurns,
      token_usage: JSON.stringify({ inputTokens: 0, outputTokens: 0, totalTokens: 0 }),
      pending_approval: null,
      pending_question: null,
      working_branch: null,
      commits: '[]',
      structured_plan: null,
    };

    await this.#db('tickets').insert(row);

    await this.#audit(id, 'ticket_created', `Created ticket: ${input.title}`);

    return rowToTicket(row);
  };

  get = async (id: string): Promise<Ticket> => {
    const row = await this.#db<TicketRow>('tickets').where('id', id).first();
    if (!row) {
      throw new TicketNotFoundError(id);
    }
    return rowToTicket(row);
  };

  list = async (status?: TicketStatus): Promise<Ticket[]> => {
    let query = this.#db<TicketRow>('tickets').orderBy('created_at', 'desc');
    if (status) {
      query = query.where('status', status);
    }
    const rows = await query;
    return rows.map(rowToTicket);
  };

  update = async (id: string, input: UpdateTicketInput): Promise<Ticket> => {
    const existing = await this.get(id);

    const updates: Partial<TicketRow> = {
      updated_at: new Date().toISOString(),
    };

    if (input.title !== undefined) {
      updates.title = input.title;
    }
    if (input.description !== undefined) {
      updates.description = input.description;
    }
    if (input.priority !== undefined) {
      updates.priority = input.priority;
    }
    if (input.maxTurns !== undefined) {
      updates.max_turns = input.maxTurns;
    }

    await this.#db('tickets').where('id', id).update(updates);

    await this.#audit(id, 'ticket_updated', `Updated ticket: ${existing.title}`);

    return this.get(id);
  };

  delete = async (id: string): Promise<void> => {
    const existing = await this.get(id);

    await this.#db('audit_logs').where('ticket_id', id).delete();
    await this.#db('agent_states').where('ticket_id', id).delete();
    await this.#db('tickets').where('id', id).delete();

    await this.#audit(id, 'ticket_updated', `Deleted ticket: ${existing.title}`);
  };

  transitionStatus = async (id: string, newStatus: TicketStatus): Promise<Ticket> => {
    const ticket = await this.get(id);
    const validTransitions = VALID_TRANSITIONS[ticket.status];

    if (!validTransitions?.includes(newStatus)) {
      throw new InvalidStatusTransitionError(ticket.status, newStatus);
    }

    const updates: Partial<TicketRow> = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    };

    if (newStatus === 'completed' || newStatus === 'failed' || newStatus === 'cancelled') {
      updates.resolved_at = new Date().toISOString();
    }

    await this.#db('tickets').where('id', id).update(updates);

    await this.#audit(id, 'status_changed', `Status changed from ${ticket.status} to ${newStatus}`, {
      stateChange: {
        field: 'status',
        oldValue: ticket.status,
        newValue: newStatus,
      },
    });

    return this.get(id);
  };

  approvePlan = async (id: string, input: ApproveTicketInput): Promise<Ticket> => {
    const ticket = await this.get(id);

    if (!ticket.structuredPlan) {
      throw new NoPlanError(id);
    }

    const now = new Date().toISOString();

    // Update the structured plan with approval info
    const approvedPlan: StructuredPlan = {
      ...ticket.structuredPlan,
      approvedAt: now,
      approvedBy: input.approvedBy,
    };

    await this.#db('tickets')
      .where('id', id)
      .update({
        structured_plan: JSON.stringify(approvedPlan),
        status: 'approved',
        updated_at: now,
      });

    await this.#audit(id, 'plan_approved', `Plan approved by ${input.approvedBy}`);

    return this.get(id);
  };

  requestApproval = async (id: string, approval: PendingApproval): Promise<Ticket> => {
    await this.get(id);

    await this.#db('tickets')
      .where('id', id)
      .update({
        pending_approval: JSON.stringify(approval),
        status: 'awaiting_input',
        updated_at: new Date().toISOString(),
      });

    await this.#audit(id, 'approval_requested', `Approval requested: ${approval.description}`);

    return this.get(id);
  };

  grantApproval = async (id: string): Promise<Ticket> => {
    const ticket = await this.get(id);

    if (!ticket.pendingApproval) {
      throw new NoPendingApprovalError(id);
    }

    await this.#db('tickets').where('id', id).update({
      pending_approval: null,
      status: 'in_progress',
      updated_at: new Date().toISOString(),
    });

    await this.#audit(id, 'approval_granted', 'Approval granted');

    return this.get(id);
  };

  denyApproval = async (id: string): Promise<Ticket> => {
    const ticket = await this.get(id);

    if (!ticket.pendingApproval) {
      throw new NoPendingApprovalError(id);
    }

    await this.#db('tickets').where('id', id).update({
      pending_approval: null,
      status: 'in_progress',
      updated_at: new Date().toISOString(),
    });

    await this.#audit(id, 'approval_denied', 'Approval denied');

    return this.get(id);
  };

  askQuestion = async (id: string, question: PendingQuestion): Promise<Ticket> => {
    await this.get(id);

    await this.#db('tickets')
      .where('id', id)
      .update({
        pending_question: JSON.stringify(question),
        status: 'awaiting_input',
        updated_at: new Date().toISOString(),
      });

    await this.#audit(id, 'question_asked', `Question asked: ${question.question}`);

    return this.get(id);
  };

  answerQuestion = async (id: string, input: AnswerQuestionInput): Promise<Ticket> => {
    const ticket = await this.get(id);

    if (!ticket.pendingQuestion) {
      throw new NoPendingQuestionError(id);
    }

    await this.#db('tickets').where('id', id).update({
      pending_question: null,
      status: 'in_progress',
      updated_at: new Date().toISOString(),
    });

    await this.#audit(id, 'question_answered', `Question answered: ${input.answer}`);

    return this.get(id);
  };

  incrementTurn = async (id: string, tokenUsage?: TokenUsage): Promise<Ticket> => {
    const ticket = await this.get(id);

    const newTokenUsage = tokenUsage
      ? {
          inputTokens: ticket.tokenUsage.inputTokens + tokenUsage.inputTokens,
          outputTokens: ticket.tokenUsage.outputTokens + tokenUsage.outputTokens,
          totalTokens: ticket.tokenUsage.totalTokens + tokenUsage.totalTokens,
        }
      : ticket.tokenUsage;

    await this.#db('tickets')
      .where('id', id)
      .update({
        current_turn: ticket.currentTurn + 1,
        token_usage: JSON.stringify(newTokenUsage),
        updated_at: new Date().toISOString(),
      });

    await this.#audit(id, 'turn_completed', `Turn ${ticket.currentTurn + 1} completed`, {
      tokenUsage: tokenUsage ?? undefined,
    });

    return this.get(id);
  };

  addCommit = async (id: string, commit: CommitInfo): Promise<Ticket> => {
    const ticket = await this.get(id);

    const commits = [...ticket.commits, commit];

    await this.#db('tickets')
      .where('id', id)
      .update({
        commits: JSON.stringify(commits),
        updated_at: new Date().toISOString(),
      });

    await this.#audit(id, 'commit_created', `Commit created: ${commit.sha.substring(0, 7)}`);

    return this.get(id);
  };

  setWorkingBranch = async (id: string, branch: string): Promise<Ticket> => {
    await this.get(id);

    await this.#db('tickets').where('id', id).update({
      working_branch: branch,
      updated_at: new Date().toISOString(),
    });

    return this.get(id);
  };

  setStructuredPlan = async (id: string, plan: StructuredPlan): Promise<Ticket> => {
    await this.get(id);

    await this.#db('tickets')
      .where('id', id)
      .update({
        structured_plan: JSON.stringify(plan),
        updated_at: new Date().toISOString(),
      });

    await this.#audit(id, 'plan_generated', 'Structured plan generated');

    return this.get(id);
  };

  updatePlanStep = async (id: string, stepIndex: number, update: Partial<PlanStep>): Promise<Ticket> => {
    const ticket = await this.get(id);

    if (!ticket.structuredPlan) {
      throw new NoPlanError(id);
    }

    const updatedSteps = ticket.structuredPlan.steps.map((step, idx) =>
      idx === stepIndex ? { ...step, ...update } : step,
    );

    const updatedPlan: StructuredPlan = {
      ...ticket.structuredPlan,
      steps: updatedSteps,
    };

    await this.#db('tickets')
      .where('id', id)
      .update({
        structured_plan: JSON.stringify(updatedPlan),
        updated_at: new Date().toISOString(),
      });

    return this.get(id);
  };

  getCurrentStep = async (id: string): Promise<PlanStep | null> => {
    const ticket = await this.get(id);

    if (!ticket.structuredPlan) {
      return null;
    }

    return ticket.structuredPlan.steps.find((step) => step.status === 'in_progress') ?? null;
  };
}

const registerTicketService = (container: ServiceContainer): void => {
  container.register('tickets', async (c) => {
    const db = await c.resolve<Knex>('database');
    const service = new TicketService(db, c.config.tickets.defaultMaxTurns);

    if (c.has('audit')) {
      const auditService = await c.resolve<AuditService>('audit');
      service.setAuditService(auditService);
    }

    return service;
  });
};

export { TicketService, registerTicketService };
