import type { FastifyInstance } from 'fastify';

import type { ServiceContainer } from '#root/services/services.ts';
import type { TicketService } from '#root/tickets/tickets.ts';
import type { AuditService } from '#root/audit/audit.ts';
import type { AgentService } from '#root/agent/agent.ts';
import {
  createTicketInputSchema,
  updateTicketInputSchema,
  approveTicketInputSchema,
  answerQuestionInputSchema,
} from '#root/tickets/tickets.schemas.ts';
import { ticketStatusSchema } from '#root/database/database.schemas.ts';
import { TicketError, TicketNotFoundError } from '#root/tickets/tickets.errors.ts';

const registerTicketRoutes = async (server: FastifyInstance, container: ServiceContainer): Promise<void> => {
  const getTicketService = async (): Promise<TicketService> => {
    return container.resolve<TicketService>('tickets');
  };

  const getAuditService = async (): Promise<AuditService> => {
    return container.resolve<AuditService>('audit');
  };

  const getAgentService = async (): Promise<AgentService> => {
    return container.resolve<AgentService>('agent');
  };

  server.post('/api/tickets', async (request, reply) => {
    const ticketService = await getTicketService();
    const result = createTicketInputSchema.safeParse(request.body);

    if (!result.success) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: result.error.message },
      });
    }

    const ticket = await ticketService.create(result.data);
    return reply.status(201).send(ticket);
  });

  server.get('/api/tickets', async (request, reply) => {
    const ticketService = await getTicketService();
    const query = request.query as { status?: string };
    const statusResult = query.status
      ? ticketStatusSchema.safeParse(query.status)
      : { success: true as const, data: undefined };

    if (!statusResult.success) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid status' },
      });
    }

    const tickets = await ticketService.list(statusResult.data);
    return reply.send(tickets);
  });

  server.get('/api/tickets/:id', async (request, reply) => {
    const ticketService = await getTicketService();
    const { id } = request.params as { id: string };

    try {
      const ticket = await ticketService.get(id);
      return reply.send(ticket);
    } catch (error) {
      if (error instanceof TicketNotFoundError) {
        return reply.status(404).send({
          error: { code: error.code, message: error.message },
        });
      }
      throw error;
    }
  });

  server.patch('/api/tickets/:id', async (request, reply) => {
    const ticketService = await getTicketService();
    const { id } = request.params as { id: string };
    const result = updateTicketInputSchema.safeParse(request.body);

    if (!result.success) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: result.error.message },
      });
    }

    try {
      const ticket = await ticketService.update(id, result.data);
      return reply.send(ticket);
    } catch (error) {
      if (error instanceof TicketNotFoundError) {
        return reply.status(404).send({
          error: { code: error.code, message: error.message },
        });
      }
      throw error;
    }
  });

  server.delete('/api/tickets/:id', async (request, reply) => {
    const ticketService = await getTicketService();
    const { id } = request.params as { id: string };

    try {
      await ticketService.delete(id);
      return reply.status(204).send();
    } catch (error) {
      if (error instanceof TicketNotFoundError) {
        return reply.status(404).send({
          error: { code: error.code, message: error.message },
        });
      }
      throw error;
    }
  });

  server.post('/api/tickets/:id/status', async (request, reply) => {
    const ticketService = await getTicketService();
    const { id } = request.params as { id: string };
    const body = request.body as { status?: string };
    const statusResult = ticketStatusSchema.safeParse(body.status);

    if (!statusResult.success) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid status' },
      });
    }

    try {
      const ticket = await ticketService.transitionStatus(id, statusResult.data);
      return reply.send(ticket);
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

  server.post('/api/tickets/:id/approve', async (request, reply) => {
    const ticketService = await getTicketService();
    const { id } = request.params as { id: string };
    const result = approveTicketInputSchema.safeParse(request.body);

    if (!result.success) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: result.error.message },
      });
    }

    try {
      const ticket = await ticketService.approvePlan(id, result.data);
      return reply.send(ticket);
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

  server.post('/api/tickets/:id/approval/grant', async (request, reply) => {
    const ticketService = await getTicketService();
    const agentService = await getAgentService();
    const { id } = request.params as { id: string };

    try {
      await ticketService.grantApproval(id);
      const result = await agentService.resume(id, { type: 'approval', approved: true });
      return reply.send(result);
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

  server.post('/api/tickets/:id/approval/deny', async (request, reply) => {
    const ticketService = await getTicketService();
    const agentService = await getAgentService();
    const { id } = request.params as { id: string };

    try {
      await ticketService.denyApproval(id);
      const result = await agentService.resume(id, { type: 'approval', approved: false });
      return reply.send(result);
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

  server.post('/api/tickets/:id/answer', async (request, reply) => {
    const ticketService = await getTicketService();
    const agentService = await getAgentService();
    const { id } = request.params as { id: string };
    const parseResult = answerQuestionInputSchema.safeParse(request.body);

    if (!parseResult.success) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: parseResult.error.message },
      });
    }

    try {
      await ticketService.answerQuestion(id, parseResult.data);
      const result = await agentService.resume(id, { type: 'answer', answer: parseResult.data.answer });
      return reply.send(result);
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

  server.get('/api/tickets/:id/audit', async (request, reply) => {
    const auditService = await getAuditService();
    const { id } = request.params as { id: string };
    const logs = await auditService.getByTicket(id);
    return reply.send(logs);
  });
};

export { registerTicketRoutes };
