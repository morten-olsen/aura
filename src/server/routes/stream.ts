import type { FastifyInstance } from 'fastify';

import type { ServiceContainer } from '#root/services/services.ts';
import type { TicketService } from '#root/tickets/tickets.ts';
import { TicketNotFoundError } from '#root/tickets/tickets.errors.ts';

const registerStreamRoutes = async (server: FastifyInstance, container: ServiceContainer): Promise<void> => {
  const getTicketService = async (): Promise<TicketService> => {
    return container.resolve<TicketService>('tickets');
  };

  server.get('/api/tickets/:id/stream', async (request, reply) => {
    const ticketService = await getTicketService();
    const { id } = request.params as { id: string };

    try {
      const ticket = await ticketService.get(id);

      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });

      const sendEvent = (event: string, data: unknown): void => {
        reply.raw.write(`event: ${event}\n`);
        reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
      };

      sendEvent('connected', { ticketId: id });
      sendEvent('ticket', ticket);

      // Send initial step progress if structured plan exists
      if (ticket.structuredPlan) {
        const inProgressStep = ticket.structuredPlan.steps.find((s) => s.status === 'in_progress');
        const completedSteps = ticket.structuredPlan.steps.filter((s) => s.status === 'completed').length;

        sendEvent('step_progress', {
          currentStepIndex: inProgressStep?.index ?? -1,
          totalSteps: ticket.structuredPlan.steps.length,
          completedSteps,
          currentStepTitle: inProgressStep?.title ?? null,
        });
      }

      const intervalId = setInterval(async () => {
        try {
          const updatedTicket = await ticketService.get(id);
          sendEvent('ticket', updatedTicket);

          // Send step progress if structured plan exists
          if (updatedTicket.structuredPlan) {
            const inProgressStep = updatedTicket.structuredPlan.steps.find((s) => s.status === 'in_progress');
            const completedSteps = updatedTicket.structuredPlan.steps.filter((s) => s.status === 'completed').length;

            sendEvent('step_progress', {
              currentStepIndex: inProgressStep?.index ?? -1,
              totalSteps: updatedTicket.structuredPlan.steps.length,
              completedSteps,
              currentStepTitle: inProgressStep?.title ?? null,
            });
          }
        } catch {
          clearInterval(intervalId);
          reply.raw.end();
        }
      }, 5000);

      request.raw.on('close', () => {
        clearInterval(intervalId);
      });
    } catch (error) {
      if (error instanceof TicketNotFoundError) {
        return reply.status(404).send({
          error: { code: error.code, message: error.message },
        });
      }
      throw error;
    }
  });
};

export { registerStreamRoutes };
