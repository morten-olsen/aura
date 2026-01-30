import path from 'node:path';
import fs from 'node:fs';

import knex, { type Knex } from 'knex';

import type { AuraConfig } from '#root/config/config.ts';
import type { ServiceContainer } from '#root/services/services.ts';

const createKnexConfig = (config: AuraConfig): Knex.Config => {
  const client = config.database.client;

  if (client === 'better-sqlite3') {
    const filename = config.database.connection.filename;
    const dir = path.dirname(filename);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    return {
      client: 'better-sqlite3',
      connection: {
        filename,
      },
      useNullAsDefault: true,
      migrations: {
        directory: path.join(import.meta.dirname, 'migrations'),
        loadExtensions: ['.ts'],
      },
    };
  }

  return {
    client: 'pg',
    connection: {
      host: config.database.connection.host,
      port: config.database.connection.port,
      database: config.database.connection.database,
      user: config.database.connection.user,
      password: config.database.connection.password,
    },
    migrations: {
      directory: path.join(import.meta.dirname, 'migrations'),
      loadExtensions: ['.ts'],
    },
  };
};

const createDatabase = (config: AuraConfig): Knex => {
  const knexConfig = createKnexConfig(config);
  return knex(knexConfig);
};

const runMigrations = async (db: Knex): Promise<void> => {
  await db.migrate.latest();
};

const registerDatabase = (container: ServiceContainer): void => {
  let db: Knex | undefined;

  container.register(
    'database',
    () => {
      db = createDatabase(container.config);
      return db;
    },
    async () => {
      if (db) {
        await db.destroy();
      }
    },
  );
};

export { createKnexConfig, createDatabase, runMigrations, registerDatabase };
