import type { FastifyInstance } from 'fastify';

const registerHealthRoutes = async (server: FastifyInstance): Promise<void> => {
  server.get('/api/health', async (_request, reply) => {
    return reply.send({
      status: 'ok',
      timestamp: new Date().toISOString(),
    });
  });
};

export { registerHealthRoutes };
