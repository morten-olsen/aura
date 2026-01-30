import fs from 'node:fs';

import convict from 'convict';

const config = convict({
  env: {
    doc: 'The application environment',
    format: ['production', 'development', 'test'],
    default: 'development',
    env: 'AURA_ENV',
  },
  server: {
    host: {
      doc: 'The host to bind to',
      format: String,
      default: '0.0.0.0',
      env: 'AURA_SERVER_HOST',
    },
    port: {
      doc: 'The port to bind to',
      format: 'port',
      default: 4000,
      env: 'AURA_SERVER_PORT',
    },
    cors: {
      origin: {
        doc: 'CORS allowed origins',
        format: Array,
        default: ['*'],
        env: 'AURA_SERVER_CORS_ORIGIN',
      },
    },
  },
  database: {
    client: {
      doc: 'Database client (better-sqlite3 or pg)',
      format: ['better-sqlite3', 'pg'],
      default: 'better-sqlite3' as const,
      env: 'AURA_DATABASE_CLIENT',
    },
    connection: {
      filename: {
        doc: 'SQLite database file path',
        format: String,
        default: './data/aura.db',
        env: 'AURA_DATABASE_FILENAME',
      },
      host: {
        doc: 'PostgreSQL host',
        format: String,
        default: 'localhost',
        env: 'AURA_DATABASE_HOST',
      },
      port: {
        doc: 'PostgreSQL port',
        format: 'port',
        default: 5432,
        env: 'AURA_DATABASE_PORT',
      },
      database: {
        doc: 'PostgreSQL database name',
        format: String,
        default: 'aura',
        env: 'AURA_DATABASE_NAME',
      },
      user: {
        doc: 'PostgreSQL user',
        format: String,
        default: 'aura',
        env: 'AURA_DATABASE_USER',
      },
      password: {
        doc: 'PostgreSQL password',
        format: String,
        default: '',
        env: 'AURA_DATABASE_PASSWORD',
        sensitive: true,
      },
    },
  },
  tickets: {
    defaultMaxTurns: {
      doc: 'Default maximum turns for a ticket',
      format: 'int',
      default: 50,
      env: 'AURA_TICKETS_DEFAULT_MAX_TURNS',
    },
  },
  git: {
    repoUrl: {
      doc: 'Git repository URL to clone',
      format: String,
      default: '',
      env: 'AURA_GIT_REPO_URL',
    },
    branch: {
      doc: 'Default branch name',
      format: String,
      default: 'main',
      env: 'AURA_GIT_BRANCH',
    },
    workingDir: {
      doc: 'Working directory for git operations',
      format: String,
      default: './workspace',
      env: 'AURA_GIT_WORKING_DIR',
    },
    authorName: {
      doc: 'Git author name for commits',
      format: String,
      default: 'Aura Agent',
      env: 'AURA_GIT_AUTHOR_NAME',
    },
    authorEmail: {
      doc: 'Git author email for commits',
      format: String,
      default: 'aura@localhost',
      env: 'AURA_GIT_AUTHOR_EMAIL',
    },
  },
  logging: {
    level: {
      doc: 'Logging level',
      format: ['debug', 'info', 'warn', 'error'],
      default: 'info',
      env: 'AURA_LOGGING_LEVEL',
    },
  },
  llm: {
    baseUrl: {
      doc: 'OpenAI-compatible API endpoint',
      format: String,
      default: 'https://api.openai.com/v1',
      env: 'AURA_LLM_BASE_URL',
    },
    apiKey: {
      doc: 'API key for LLM provider',
      format: String,
      default: '',
      env: 'AURA_LLM_API_KEY',
      sensitive: true,
    },
    model: {
      doc: 'Model identifier',
      format: String,
      default: 'gpt-4-turbo',
      env: 'AURA_LLM_MODEL',
    },
    maxTokensPerTurn: {
      doc: 'Maximum tokens per agent turn',
      format: 'int',
      default: 4096,
      env: 'AURA_LLM_MAX_TOKENS',
    },
    temperature: {
      doc: 'Model temperature (0-2)',
      format: Number,
      default: 0.1,
      env: 'AURA_LLM_TEMPERATURE',
    },
  },
  agent: {
    planApprovalRequired: {
      doc: 'Require human approval for plans',
      format: Boolean,
      default: true,
      env: 'AURA_AGENT_PLAN_APPROVAL',
    },
    destructiveActionApproval: {
      doc: 'Require approval for destructive actions',
      format: Boolean,
      default: true,
      env: 'AURA_AGENT_DESTRUCTIVE_APPROVAL',
    },
  },
});

type AuraConfig = ReturnType<typeof config.getProperties>;

const loadConfig = (configDir?: string): AuraConfig => {
  const env = config.get('env');

  if (configDir) {
    const configFiles = [`${configDir}/default.json`, `${configDir}/${env}.json`, `${configDir}/local.json`].filter(
      (file) => fs.existsSync(file),
    );

    if (configFiles.length > 0) {
      config.loadFile(configFiles);
    }
  }

  config.validate({ allowed: 'strict' });

  return config.getProperties();
};

export type { AuraConfig };
export { config, loadConfig };
