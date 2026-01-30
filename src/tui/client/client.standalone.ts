import type { Knex } from 'knex';
import type { FastifyInstance } from 'fastify';

import type { UnsubscribeFn } from '../tui.types.ts';

import type { AuraClient, ListTicketsFilters, StreamEventHandler } from './client.ts';

import { loadConfig } from '#root/config/config.ts';
import { ServiceContainer } from '#root/services/services.ts';
import { registerDatabase, runMigrations } from '#root/database/database.ts';
import { registerAuditService } from '#root/audit/audit.ts';
import type { TicketService } from '#root/tickets/tickets.ts';
import { registerTicketService } from '#root/tickets/tickets.ts';
import { registerValidationService } from '#root/validation/validation.ts';
import { registerGitService } from '#root/git/git.ts';
import { registerCdk8sService } from '#root/cdk8s/cdk8s.ts';
import type { AgentService } from '#root/agent/agent.ts';
import { registerAgentService } from '#root/agent/agent.ts';
import { createServer } from '#root/server/server.ts';
import type {
  Ticket,
  CreateTicketInput,
  ApproveTicketInput,
  AnswerQuestionInput,
} from '#root/tickets/tickets.schemas.ts';
import type { AgentRunResult } from '#root/agent/agent.schemas.ts';

type StandaloneClientConfig = {
  configDir?: string;
};

type StandaloneClientInstance = {
  client: AuraClient;
  container: ServiceContainer;
  server: FastifyInstance;
  destroy: () => Promise<void>;
};

const createStandaloneClient = async (config: StandaloneClientConfig = {}): Promise<StandaloneClientInstance> => {
  const { configDir } = config;

  // Load configuration
  const auraConfig = loadConfig(configDir);

  // Create service container
  const container = new ServiceContainer(auraConfig);

  // Register all services
  registerDatabase(container);
  registerAuditService(container);
  registerValidationService(container);
  registerGitService(container);
  registerTicketService(container);
  registerCdk8sService(container);
  registerAgentService(container);

  // Run database migrations
  const db = await container.resolve<Knex>('database');
  await runMigrations(db);

  // Create server (but don't start it listening)
  const serverConfig = {
    host: '127.0.0.1',
    port: 0, // Not used since we don't listen
    corsOrigin: ['*'],
  };

  const server = await createServer(container, serverConfig);

  // Get services directly
  const getTicketService = async (): Promise<TicketService> => {
    return container.resolve<TicketService>('tickets');
  };

  const getAgentService = async (): Promise<AgentService> => {
    return container.resolve<AgentService>('agent');
  };

  // Create direct client that bypasses HTTP
  const client: AuraClient = {
    listTickets: async (filters?: ListTicketsFilters): Promise<Ticket[]> => {
      const ticketService = await getTicketService();
      return ticketService.list(filters?.status);
    },

    getTicket: async (id: string): Promise<Ticket> => {
      const ticketService = await getTicketService();
      return ticketService.get(id);
    },

    createTicket: async (data: CreateTicketInput): Promise<Ticket> => {
      const ticketService = await getTicketService();
      return ticketService.create(data);
    },

    updateTicket: async (id: string, data: Partial<CreateTicketInput>): Promise<Ticket> => {
      const ticketService = await getTicketService();
      return ticketService.update(id, data);
    },

    deleteTicket: async (id: string): Promise<void> => {
      const ticketService = await getTicketService();
      await ticketService.delete(id);
    },

    approvePlan: async (id: string, input: ApproveTicketInput): Promise<Ticket> => {
      const ticketService = await getTicketService();
      return ticketService.approvePlan(id, input);
    },

    grantApproval: async (id: string): Promise<AgentRunResult> => {
      const ticketService = await getTicketService();
      const agentService = await getAgentService();
      await ticketService.grantApproval(id);
      return agentService.resume(id, { type: 'approval', approved: true });
    },

    denyApproval: async (id: string): Promise<AgentRunResult> => {
      const ticketService = await getTicketService();
      const agentService = await getAgentService();
      await ticketService.denyApproval(id);
      return agentService.resume(id, { type: 'approval', approved: false });
    },

    answerQuestion: async (id: string, input: AnswerQuestionInput): Promise<AgentRunResult> => {
      const ticketService = await getTicketService();
      const agentService = await getAgentService();
      await ticketService.answerQuestion(id, input);
      return agentService.resume(id, { type: 'answer', answer: input.answer });
    },

    startAgent: async (ticketId: string): Promise<AgentRunResult> => {
      const agentService = await getAgentService();
      return agentService.run(ticketId);
    },

    cancelAgent: async (ticketId: string): Promise<void> => {
      const agentService = await getAgentService();
      await agentService.cancel(ticketId);
    },

    subscribeToTicket: (id: string, handler: StreamEventHandler): UnsubscribeFn => {
      // For standalone mode, we use polling instead of SSE
      // since there's no HTTP server running
      let isActive = true;

      const poll = async (): Promise<void> => {
        if (!isActive) return;

        try {
          const ticketService = await getTicketService();
          const ticket = await ticketService.get(id);

          handler({ type: 'ticket', ticket });

          // Send step progress if structured plan exists
          if (ticket.structuredPlan) {
            const inProgressStep = ticket.structuredPlan.steps.find((s) => s.status === 'in_progress');
            const completedSteps = ticket.structuredPlan.steps.filter((s) => s.status === 'completed').length;

            handler({
              type: 'step_progress',
              data: {
                currentStepIndex: inProgressStep?.index ?? -1,
                totalSteps: ticket.structuredPlan.steps.length,
                completedSteps,
                currentStepTitle: inProgressStep?.title ?? null,
              },
            });
          }
        } catch (error) {
          handler({ type: 'error', error: error instanceof Error ? error.message : 'Unknown error' });
        }

        if (isActive) {
          setTimeout(poll, 2000);
        }
      };

      // Initial connection event
      handler({ type: 'connected', ticketId: id });

      // Start polling
      poll();

      return (): void => {
        isActive = false;
      };
    },
  };

  const destroy = async (): Promise<void> => {
    await server.close();
    await container.destroy();
  };

  return {
    client,
    container,
    server,
    destroy,
  };
};

export type { StandaloneClientConfig, StandaloneClientInstance };
export { createStandaloneClient };
