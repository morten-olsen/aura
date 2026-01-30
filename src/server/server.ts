import Fastify, { type FastifyInstance, type FastifyError } from 'fastify';
import cors from '@fastify/cors';

import { registerHealthRoutes } from './routes/health.ts';
import { registerTicketRoutes } from './routes/tickets.ts';
import { registerStreamRoutes } from './routes/stream.ts';
import { registerAgentRoutes } from './routes/agent.ts';

import type { ServiceContainer } from '#root/services/services.ts';

type ServerConfig = {
  host: string;
  port: number;
  corsOrigin: string[];
};

const createServer = async (container: ServiceContainer, config: ServerConfig): Promise<FastifyInstance> => {
  const server = Fastify({
    logger: container.config.logging.level === 'debug',
  });

  await server.register(cors, {
    origin: config.corsOrigin,
  });

  server.setErrorHandler((error: FastifyError, _request, reply) => {
    const statusCode = error.statusCode ?? 500;
    const code = error.code ?? 'INTERNAL_ERROR';

    reply.status(statusCode).send({
      error: {
        code,
        message: error.message,
      },
    });
  });

  await registerHealthRoutes(server);
  await registerTicketRoutes(server, container);
  await registerStreamRoutes(server, container);
  await registerAgentRoutes(server, container);

  return server;
};

const startServer = async (server: FastifyInstance, config: ServerConfig): Promise<void> => {
  await server.listen({
    host: config.host,
    port: config.port,
  });

  console.log(`Server listening on http://${config.host}:${config.port}`);
};

export type { ServerConfig };
export { createServer, startServer };
