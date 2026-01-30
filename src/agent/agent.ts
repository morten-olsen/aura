import { ChatOpenAI } from '@langchain/openai';
import type { Knex } from 'knex';

import { createAgentGraph, AgentStateAnnotation } from './agent.graph.ts';
import { DatabaseCheckpointer } from './agent.checkpointer.ts';
import { createAllTools } from './tools/tools.ts';
import { MaxTurnsExceededError, AgentNotRunningError } from './agent.errors.ts';
import type { AgentRunResult, HumanInput, AgentState } from './agent.schemas.ts';

import type { TicketService } from '#root/tickets/tickets.ts';
import type { GitService } from '#root/git/git.ts';
import type { ValidationService } from '#root/validation/validation.ts';
import type { AuditService } from '#root/audit/audit.ts';
import type { AuraConfig } from '#root/config/config.ts';
import type { ServiceContainer } from '#root/services/services.ts';
import type { AgentPhase } from '#root/database/database.schemas.ts';

type AgentServiceDeps = {
  db: Knex;
  config: AuraConfig;
  ticketService: TicketService;
  gitService: GitService;
  validationService: ValidationService;
  auditService?: AuditService;
};

class AgentService {
  #db: Knex;
  #config: AuraConfig;
  #ticketService: TicketService;
  #gitService: GitService;
  #validationService: ValidationService;
  #auditService: AuditService | null;
  #llm: ChatOpenAI;
  #checkpointer: DatabaseCheckpointer;

  constructor(deps: AgentServiceDeps) {
    this.#db = deps.db;
    this.#config = deps.config;
    this.#ticketService = deps.ticketService;
    this.#gitService = deps.gitService;
    this.#validationService = deps.validationService;
    this.#auditService = deps.auditService ?? null;

    this.#llm = new ChatOpenAI({
      model: this.#config.llm.model,
      temperature: this.#config.llm.temperature,
      maxTokens: this.#config.llm.maxTokensPerTurn,
      configuration: { baseURL: this.#config.llm.baseUrl },
      apiKey: this.#config.llm.apiKey,
    });

    this.#checkpointer = new DatabaseCheckpointer(this.#db);
  }

  #createGraph = (ticketId: string) => {
    const tools = createAllTools({
      gitService: this.#gitService,
      validationService: this.#validationService,
      ticketService: this.#ticketService,
      ticketId,
    });
    return createAgentGraph(this.#llm, tools, this.#ticketService).compile({
      checkpointer: this.#checkpointer,
    });
  };

  #audit = async (
    ticketId: string,
    type: Parameters<AuditService['log']>[0]['type'],
    action: string,
  ): Promise<void> => {
    if (this.#auditService) {
      await this.#auditService.log({
        ticketId,
        type,
        actor: 'agent',
        action,
      });
    }
  };

  run = async (ticketId: string): Promise<AgentRunResult> => {
    // Get ticket details
    const ticket = await this.#ticketService.get(ticketId);

    // Check max turns
    if (ticket.currentTurn >= ticket.maxTurns) {
      throw new MaxTurnsExceededError(ticket.maxTurns);
    }

    // Ensure worktree exists
    try {
      await this.#gitService.getWorktree(ticketId);
    } catch {
      // Create worktree if it doesn't exist
      await this.#gitService.createWorktree(ticketId);
    }

    await this.#audit(ticketId, 'agent_started', `Agent started for ticket: ${ticket.title}`);

    // Transition ticket to in_progress if needed
    if (ticket.status === 'approved') {
      await this.#ticketService.transitionStatus(ticketId, 'in_progress');
    }

    const graph = this.#createGraph(ticketId);

    // Check if we have an approved plan - if so, provide full state for resumption
    const hasApprovedPlan = ticket.structuredPlan?.approvedAt != null;

    // Build initial state - when resuming with approved plan, include all necessary state
    // so routeFromStart can properly route to the wait/execute nodes
    const initialState = hasApprovedPlan
      ? {
          ticketId,
          ticketTitle: ticket.title,
          ticketDescription: ticket.description,
          planApprovalRequired: this.#config.agent.planApprovalRequired,
          // Include the existing plan and state for proper routing
          structuredPlan: ticket.structuredPlan,
          phase: 'waiting' as const,
          waitingFor: 'approval' as const,
          humanInput: { type: 'approval' as const, approved: true },
        }
      : {
          ticketId,
          ticketTitle: ticket.title,
          ticketDescription: ticket.description,
          planApprovalRequired: this.#config.agent.planApprovalRequired,
        };

    try {
      const result = await graph.invoke(initialState, {
        configurable: { thread_id: ticketId },
      });

      const phase = result.phase as AgentPhase;

      // Update ticket with token usage
      if (result.tokenUsage) {
        await this.#ticketService.incrementTurn(ticketId, result.tokenUsage);
      }

      // Update ticket status based on phase
      if (phase === 'completed') {
        await this.#ticketService.transitionStatus(ticketId, 'completed');
        await this.#audit(ticketId, 'agent_completed', 'Agent completed successfully');
      } else if (phase === 'waiting') {
        // Determine the correct status based on what we're waiting for
        const waitingFor = result.waitingFor as 'approval' | 'answer' | null;
        if (waitingFor === 'approval' && result.structuredPlan && !result.structuredPlan.approvedAt) {
          // Waiting for plan approval
          await this.#ticketService.transitionStatus(ticketId, 'pending_approval');
        } else {
          // Waiting for other input
          await this.#ticketService.transitionStatus(ticketId, 'awaiting_input');
        }
      }

      return {
        ticketId,
        phase,
        success: phase === 'completed',
        waitingFor: result.waitingFor ?? null,
      };
    } catch (error) {
      await this.#audit(ticketId, 'agent_completed', `Agent failed: ${(error as Error).message}`);

      return {
        ticketId,
        phase: 'completed',
        success: false,
        error: (error as Error).message,
        waitingFor: null,
      };
    }
  };

  resume = async (ticketId: string, input?: HumanInput): Promise<AgentRunResult> => {
    const ticket = await this.#ticketService.get(ticketId);

    // Check max turns
    if (ticket.currentTurn >= ticket.maxTurns) {
      throw new MaxTurnsExceededError(ticket.maxTurns);
    }

    const graph = this.#createGraph(ticketId);

    // Get current state
    const currentState = await graph.getState({ configurable: { thread_id: ticketId } });

    if (!currentState.values) {
      throw new AgentNotRunningError(ticketId);
    }

    // Clear pending approval/question based on input
    if (input?.type === 'approval') {
      if (input.approved) {
        await this.#ticketService.grantApproval(ticketId);
      } else {
        await this.#ticketService.denyApproval(ticketId);
      }
    } else if (input?.type === 'answer' && input.answer) {
      await this.#ticketService.answerQuestion(ticketId, { answer: input.answer });
    }

    await this.#audit(ticketId, 'agent_turn_started', `Agent resumed with input: ${input?.type ?? 'none'}`);

    try {
      const result = await graph.invoke({ humanInput: input }, { configurable: { thread_id: ticketId } });

      const phase = result.phase as AgentPhase;

      // Update ticket with token usage
      if (result.tokenUsage) {
        await this.#ticketService.incrementTurn(ticketId, result.tokenUsage);
      }

      // Update ticket status based on phase
      if (phase === 'completed') {
        await this.#ticketService.transitionStatus(ticketId, 'completed');
        await this.#audit(ticketId, 'agent_completed', 'Agent completed successfully');
      } else if (phase === 'waiting') {
        await this.#ticketService.transitionStatus(ticketId, 'awaiting_input');
      }

      return {
        ticketId,
        phase,
        success: phase === 'completed',
        waitingFor: result.waitingFor ?? null,
      };
    } catch (error) {
      await this.#audit(ticketId, 'agent_completed', `Agent failed: ${(error as Error).message}`);

      return {
        ticketId,
        phase: 'completed',
        success: false,
        error: (error as Error).message,
        waitingFor: null,
      };
    }
  };

  getState = async (ticketId: string): Promise<AgentState | null> => {
    const graph = this.#createGraph(ticketId);

    try {
      const state = await graph.getState({ configurable: { thread_id: ticketId } });

      if (!state.values) {
        return null;
      }

      const values = state.values as typeof AgentStateAnnotation.State;

      return {
        ticketId: values.ticketId,
        messages: values.messages.map((m) => ({
          role: m.getType() as 'system' | 'user' | 'assistant' | 'tool',
          content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
        })),
        structuredPlan: values.structuredPlan,
        currentStepIndex: values.currentStepIndex,
        phase: values.phase,
        tokenUsage: values.tokenUsage,
        waitingFor: values.waitingFor,
        humanInput: values.humanInput,
      };
    } catch {
      return null;
    }
  };

  cancel = async (ticketId: string): Promise<void> => {
    // Delete all checkpoints for this ticket
    await this.#checkpointer.deleteThread(ticketId);

    // Update ticket status
    try {
      await this.#ticketService.transitionStatus(ticketId, 'cancelled');
    } catch {
      // Ticket might already be in a terminal state
    }

    await this.#audit(ticketId, 'agent_completed', 'Agent cancelled by user');
  };
}

const registerAgentService = (container: ServiceContainer): void => {
  container.register('agent', async (c) => {
    const db = await c.resolve<Knex>('database');
    const ticketService = await c.resolve<TicketService>('tickets');
    const gitService = await c.resolve<GitService>('git');
    const validationService = await c.resolve<ValidationService>('validation');
    const auditService = c.has('audit') ? await c.resolve<AuditService>('audit') : undefined;

    return new AgentService({
      db,
      config: c.config,
      ticketService,
      gitService,
      validationService,
      auditService,
    });
  });
};

export type { AgentServiceDeps };
export { AgentService, registerAgentService };
