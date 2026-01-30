import type { FastifyInstance } from 'fastify';

import type { ServiceContainer } from '#root/services/services.ts';
import type { TicketService } from '#root/tickets/tickets.ts';
import type { AgentService } from '#root/agent/agent.ts';
import { TicketError, TicketNotFoundError } from '#root/tickets/tickets.errors.ts';
import { AgentNotRunningError, MaxTurnsExceededError } from '#root/agent/agent.errors.ts';
import { humanInputSchema } from '#root/agent/agent.schemas.ts';

const registerAgentRoutes = async (server: FastifyInstance, container: ServiceContainer): Promise<void> => {
  const getTicketService = async (): Promise<TicketService> => {
    return container.resolve<TicketService>('tickets');
  };

  const getAgentService = async (): Promise<AgentService> => {
    return container.resolve<AgentService>('agent');
  };

  // Start agent execution for a ticket
  server.post('/api/tickets/:id/agent/start', async (request, reply) => {
    const agentService = await getAgentService();
    const { id } = request.params as { id: string };

    try {
      const result = await agentService.run(id);
      return reply.send(result);
    } catch (error) {
      if (error instanceof TicketNotFoundError) {
        return reply.status(404).send({
          error: { code: error.code, message: error.message },
        });
      }
      if (error instanceof MaxTurnsExceededError) {
        return reply.status(400).send({
          error: { code: 'MAX_TURNS_EXCEEDED', message: error.message },
        });
      }
      throw error;
    }
  });

  // Resume agent execution with human input
  server.post('/api/tickets/:id/agent/resume', async (request, reply) => {
    const agentService = await getAgentService();
    const { id } = request.params as { id: string };

    const inputResult = humanInputSchema.safeParse(request.body);

    try {
      const result = await agentService.resume(id, inputResult.success ? inputResult.data : undefined);
      return reply.send(result);
    } catch (error) {
      if (error instanceof TicketNotFoundError) {
        return reply.status(404).send({
          error: { code: error.code, message: error.message },
        });
      }
      if (error instanceof AgentNotRunningError) {
        return reply.status(400).send({
          error: { code: 'AGENT_NOT_RUNNING', message: error.message },
        });
      }
      if (error instanceof MaxTurnsExceededError) {
        return reply.status(400).send({
          error: { code: 'MAX_TURNS_EXCEEDED', message: error.message },
        });
      }
      throw error;
    }
  });

  // Get current agent state
  server.get('/api/tickets/:id/agent/state', async (request, reply) => {
    const agentService = await getAgentService();
    const { id } = request.params as { id: string };

    try {
      const state = await agentService.getState(id);
      if (!state) {
        return reply.status(404).send({
          error: { code: 'AGENT_NOT_RUNNING', message: `No agent state found for ticket ${id}` },
        });
      }
      return reply.send(state);
    } catch (error) {
      if (error instanceof TicketNotFoundError) {
        return reply.status(404).send({
          error: { code: error.code, message: error.message },
        });
      }
      throw error;
    }
  });

  // Cancel agent execution
  server.post('/api/tickets/:id/agent/cancel', async (request, reply) => {
    const agentService = await getAgentService();
    const { id } = request.params as { id: string };

    try {
      await agentService.cancel(id);
      return reply.send({ success: true, ticketId: id });
    } catch (error) {
      if (error instanceof TicketNotFoundError) {
        return reply.status(404).send({
          error: { code: error.code, message: error.message },
        });
      }
      throw error;
    }
  });

  // Get step progress summary
  server.get('/api/tickets/:id/progress', async (request, reply) => {
    const ticketService = await getTicketService();
    const { id } = request.params as { id: string };

    try {
      const ticket = await ticketService.get(id);

      if (!ticket.structuredPlan) {
        return reply.send({
          hasStructuredPlan: false,
          currentStepIndex: -1,
          totalSteps: 0,
          completedSteps: 0,
          currentStepTitle: null,
          steps: [],
        });
      }

      const inProgressStep = ticket.structuredPlan.steps.find((s) => s.status === 'in_progress');
      const completedSteps = ticket.structuredPlan.steps.filter((s) => s.status === 'completed').length;

      return reply.send({
        hasStructuredPlan: true,
        currentStepIndex: inProgressStep?.index ?? -1,
        totalSteps: ticket.structuredPlan.steps.length,
        completedSteps,
        currentStepTitle: inProgressStep?.title ?? null,
        steps: ticket.structuredPlan.steps.map((step) => ({
          id: step.id,
          index: step.index,
          title: step.title,
          status: step.status,
          startedAt: step.startedAt,
          completedAt: step.completedAt,
        })),
      });
    } catch (error) {
      if (error instanceof TicketError) {
        const statusCode = error instanceof TicketNotFoundError ? 404 : 400;
        return reply.status(statusCode).send({
          error: { code: error.code, message: error.message },
        });
      }
      throw error;
    }
  });
};

export { registerAgentRoutes };
