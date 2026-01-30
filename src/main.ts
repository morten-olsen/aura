import type { Knex } from 'knex';

import { loadConfig } from '#root/config/config.ts';
import { ServiceContainer } from '#root/services/services.ts';
import { registerDatabase, runMigrations } from '#root/database/database.ts';
import { registerAuditService } from '#root/audit/audit.ts';
import { registerTicketService } from '#root/tickets/tickets.ts';
import { registerValidationService } from '#root/validation/validation.ts';
import { registerGitService } from '#root/git/git.ts';
import { registerCdk8sService } from '#root/cdk8s/cdk8s.ts';
import { registerAgentService } from '#root/agent/agent.ts';
import { createServer, startServer } from '#root/server/server.ts';

const main = async (): Promise<void> => {
  const configDir = process.env.AURA_CONFIG_DIR;
  const config = loadConfig(configDir);

  const container = new ServiceContainer(config);

  registerDatabase(container);
  registerAuditService(container);
  registerValidationService(container);
  registerGitService(container);
  registerTicketService(container);
  registerCdk8sService(container);
  registerAgentService(container);

  const db = await container.resolve<Knex>('database');
  await runMigrations(db);

  console.log('Database migrations completed');

  const serverConfig = {
    host: config.server.host,
    port: config.server.port,
    corsOrigin: config.server.cors.origin,
  };

  const server = await createServer(container, serverConfig);
  await startServer(server, serverConfig);

  const shutdown = async (): Promise<void> => {
    console.log('Shutting down...');
    await server.close();
    await container.destroy();
    console.log('Shutdown complete');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
};

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
