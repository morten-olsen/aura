# Configuration Guide

Aura uses [Convict](https://github.com/mozilla/node-convict) for configuration management, providing schema validation, environment variable mapping, and hierarchical configuration files.

## Configuration Sources

Configuration is loaded in order of precedence (later sources override earlier):

1. **Schema defaults** - Built-in default values
2. **`config/default.json`** - Base configuration
3. **`config/{NODE_ENV}.json`** - Environment-specific (development.json, production.json)
4. **Environment variables** - Runtime configuration
5. **`config/local.json`** - Local overrides (gitignored)

## Quick Setup

### Minimal Configuration

Create `config/local.json`:

```json
{
  "llm": {
    "model": "gpt-4-turbo"
  },
  "git": {
    "repoUrl": "git@github.com:your-org/infrastructure.git"
  }
}
```

Set the required environment variable:

```bash
export AURA_LLM_API_KEY="sk-your-api-key"
```

### Full Example

```json
{
  "llm": {
    "baseUrl": "https://api.openai.com/v1",
    "model": "gpt-4-turbo",
    "maxTokensPerTurn": 4096,
    "temperature": 0.1
  },
  "database": {
    "client": "pg",
    "connection": "postgresql://aura:password@localhost:5432/aura"
  },
  "git": {
    "repoUrl": "git@github.com:myorg/infrastructure.git",
    "branch": "main",
    "workingDir": "./workspace",
    "authorName": "Aura Agent",
    "authorEmail": "aura@myorg.com"
  },
  "kubernetes": {
    "context": "homelab",
    "namespace": ""
  },
  "argocd": {
    "server": "argocd.homelab.local",
    "appName": "infrastructure"
  },
  "sealedSecrets": {
    "controllerNamespace": "kube-system",
    "controllerName": "sealed-secrets-controller"
  },
  "notifications": {
    "provider": "ntfy",
    "ntfy": {
      "server": "https://ntfy.sh",
      "topic": "homelab-aura"
    }
  },
  "agent": {
    "defaultMaxTurns": 50,
    "planApprovalRequired": true,
    "destructiveActionApproval": true,
    "autoMergeOnResolution": true
  },
  "server": {
    "host": "0.0.0.0",
    "port": 3000
  },
  "costTracking": {
    "enabled": true,
    "promptPricePer1k": 0.01,
    "completionPricePer1k": 0.03
  }
}
```

## Configuration Reference

### LLM Configuration

Controls the AI model used by the agent.

| Key                     | Env Variable           | Default                      | Description                      |
| ----------------------- | ---------------------- | ---------------------------- | -------------------------------- |
| `llm.baseUrl`           | `AURA_LLM_BASE_URL`    | `https://api.openai.com/v1`  | OpenAI-compatible API endpoint   |
| `llm.apiKey`            | `AURA_LLM_API_KEY`     | (required)                   | API key for LLM provider         |
| `llm.model`             | `AURA_LLM_MODEL`       | `gpt-4-turbo`                | Model identifier                 |
| `llm.maxTokensPerTurn`  | `AURA_LLM_MAX_TOKENS`  | `4096`                       | Maximum tokens per agent turn    |
| `llm.temperature`       | `AURA_LLM_TEMPERATURE` | `0.1`                        | Model temperature (0-2)          |

**Using Alternative Providers:**

```json
{
  "llm": {
    "baseUrl": "https://api.anthropic.com/v1",
    "model": "claude-3-opus"
  }
}
```

For local models (Ollama, vLLM):

```json
{
  "llm": {
    "baseUrl": "http://localhost:11434/v1",
    "model": "llama2:70b",
    "apiKey": "not-needed"
  }
}
```

### Database Configuration

Supports SQLite (development) and PostgreSQL (production).

| Key                   | Env Variable        | Default         | Description                    |
| --------------------- | ------------------- | --------------- | ------------------------------ |
| `database.client`     | `AURA_DB_CLIENT`    | `sqlite3`       | Database type: `sqlite3`, `pg` |
| `database.connection` | `AURA_DB_CONNECTION`| `./data/aura.db`| Connection string or path      |

**SQLite (Default):**

```json
{
  "database": {
    "client": "sqlite3",
    "connection": "./data/aura.db"
  }
}
```

**PostgreSQL:**

```json
{
  "database": {
    "client": "pg",
    "connection": "postgresql://user:pass@host:5432/aura"
  }
}
```

### Git Configuration

Controls how Aura interacts with your infrastructure repository.

| Key                 | Env Variable             | Default           | Description                    |
| ------------------- | ------------------------ | ----------------- | ------------------------------ |
| `git.repoUrl`       | `AURA_GIT_REPO_URL`      | (required)        | Infrastructure repository URL  |
| `git.branch`        | `AURA_GIT_BRANCH`        | `main`            | Main branch name               |
| `git.workingDir`    | `AURA_GIT_WORKING_DIR`   | `./workspace`     | Local working directory        |
| `git.authorName`    | `AURA_GIT_AUTHOR_NAME`   | `Aura Agent`      | Git commit author name         |
| `git.authorEmail`   | `AURA_GIT_AUTHOR_EMAIL`  | `aura@localhost`  | Git commit author email        |

**SSH Authentication:**

Ensure your SSH key is configured:

```bash
# Add to SSH agent
ssh-add ~/.ssh/id_rsa

# Or configure in SSH config
# ~/.ssh/config
Host github.com
  IdentityFile ~/.ssh/aura_deploy_key
```

**HTTPS with Credentials:**

```bash
# Use credential helper
git config --global credential.helper store
```

### Kubernetes Configuration

| Key                     | Env Variable         | Default | Description                           |
| ----------------------- | -------------------- | ------- | ------------------------------------- |
| `kubernetes.context`    | `AURA_K8S_CONTEXT`   | (empty) | kubectl context (empty = default)     |
| `kubernetes.namespace`  | `AURA_K8S_NAMESPACE` | (empty) | Default namespace (empty = all)       |

### ArgoCD Configuration

| Key               | Env Variable          | Default                                    | Description                  |
| ----------------- | --------------------- | ------------------------------------------ | ---------------------------- |
| `argocd.server`   | `AURA_ARGOCD_SERVER`  | `argocd-server.argocd.svc.cluster.local`   | ArgoCD server address        |
| `argocd.token`    | `AURA_ARGOCD_TOKEN`   | (empty)                                    | ArgoCD API token (optional)  |
| `argocd.appName`  | `AURA_ARGOCD_APP_NAME`| `infrastructure`                           | Main ArgoCD application name |

**In-Cluster Access:**

When running inside Kubernetes, use the internal service name and rely on ServiceAccount authentication.

**External Access:**

```json
{
  "argocd": {
    "server": "argocd.homelab.local",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

Generate a token:

```bash
argocd account generate-token --account aura
```

### Sealed Secrets Configuration

| Key                                | Env Variable                       | Default                     | Description                      |
| ---------------------------------- | ---------------------------------- | --------------------------- | -------------------------------- |
| `sealedSecrets.controllerNamespace`| `AURA_SEALED_SECRETS_NAMESPACE`    | `kube-system`               | Controller namespace             |
| `sealedSecrets.controllerName`     | `AURA_SEALED_SECRETS_CONTROLLER`   | `sealed-secrets-controller` | Controller deployment name       |

### Notifications Configuration

| Key                      | Env Variable          | Default          | Description                  |
| ------------------------ | --------------------- | ---------------- | ---------------------------- |
| `notifications.provider` | `AURA_NOTIFY_PROVIDER`| `none`           | Provider: `none`, `ntfy`     |
| `notifications.ntfy.server` | `AURA_NTFY_SERVER` | `https://ntfy.sh`| ntfy server URL              |
| `notifications.ntfy.topic`  | `AURA_NTFY_TOPIC`  | `aura`           | ntfy topic name              |
| `notifications.ntfy.token`  | `AURA_NTFY_TOKEN`  | (empty)          | ntfy access token (optional) |

**Self-hosted ntfy:**

```json
{
  "notifications": {
    "provider": "ntfy",
    "ntfy": {
      "server": "https://ntfy.homelab.local",
      "topic": "aura-alerts",
      "token": "tk_your_token"
    }
  }
}
```

### Agent Behavior Configuration

| Key                              | Env Variable                       | Default | Description                           |
| -------------------------------- | ---------------------------------- | ------- | ------------------------------------- |
| `agent.defaultMaxTurns`          | `AURA_AGENT_MAX_TURNS`             | `50`    | Default max turns per ticket          |
| `agent.planApprovalRequired`     | `AURA_AGENT_PLAN_APPROVAL`         | `true`  | Require human approval for plans      |
| `agent.destructiveActionApproval`| `AURA_AGENT_DESTRUCTIVE_APPROVAL`  | `true`  | Require approval for destructive ops  |
| `agent.autoMergeOnResolution`    | `AURA_AGENT_AUTO_MERGE`            | `true`  | Auto-merge to main on resolution      |

**Fully Autonomous Mode (Use with Caution):**

```json
{
  "agent": {
    "planApprovalRequired": false,
    "destructiveActionApproval": false,
    "autoMergeOnResolution": true
  }
}
```

### Server Configuration

| Key           | Env Variable       | Default    | Description              |
| ------------- | ------------------ | ---------- | ------------------------ |
| `server.host` | `AURA_SERVER_HOST` | `0.0.0.0`  | Server bind address      |
| `server.port` | `AURA_SERVER_PORT` | `3000`     | Server port              |

### Cost Tracking Configuration

| Key                           | Env Variable                 | Default | Description                     |
| ----------------------------- | ---------------------------- | ------- | ------------------------------- |
| `costTracking.enabled`        | `AURA_COST_TRACKING_ENABLED` | `true`  | Enable cost tracking            |
| `costTracking.promptPricePer1k`   | `AURA_COST_PROMPT_PRICE` | `0.01`  | Price per 1K prompt tokens (USD)|
| `costTracking.completionPricePer1k`| `AURA_COST_COMPLETION_PRICE`| `0.03` | Price per 1K completion tokens  |

Update prices based on your model:

```json
{
  "costTracking": {
    "enabled": true,
    "promptPricePer1k": 0.01,
    "completionPricePer1k": 0.03
  }
}
```

## Environment-Specific Configuration

### Development (`config/development.json`)

```json
{
  "database": {
    "client": "sqlite3",
    "connection": "./data/aura-dev.db"
  },
  "agent": {
    "planApprovalRequired": true,
    "defaultMaxTurns": 20
  },
  "server": {
    "port": 3000
  }
}
```

### Production (`config/production.json`)

```json
{
  "database": {
    "client": "pg"
  },
  "agent": {
    "planApprovalRequired": true,
    "destructiveActionApproval": true
  },
  "notifications": {
    "provider": "ntfy"
  }
}
```

Set environment-specific connection via environment variable:

```bash
export NODE_ENV=production
export AURA_DB_CONNECTION="postgresql://aura:$DB_PASSWORD@db.internal:5432/aura"
```

## Docker Configuration

When running in Docker, use environment variables:

```bash
docker run -d \
  -e AURA_LLM_API_KEY="$AURA_LLM_API_KEY" \
  -e AURA_LLM_MODEL="gpt-4-turbo" \
  -e AURA_GIT_REPO_URL="git@github.com:org/infra.git" \
  -e AURA_DB_CLIENT="pg" \
  -e AURA_DB_CONNECTION="postgresql://aura:pass@postgres:5432/aura" \
  -e AURA_ARGOCD_SERVER="argocd.cluster.local" \
  -v ~/.ssh:/root/.ssh:ro \
  -v ~/.kube:/root/.kube:ro \
  ghcr.io/your-org/aura:latest
```

Or mount a config file:

```bash
docker run -d \
  -v ./config:/config:ro \
  -e AURA_LLM_API_KEY="$AURA_LLM_API_KEY" \
  ghcr.io/your-org/aura:latest
```

## Kubernetes ConfigMap

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: aura-config
  namespace: aura-system
data:
  config.json: |
    {
      "llm": {
        "model": "gpt-4-turbo"
      },
      "database": {
        "client": "pg"
      },
      "git": {
        "repoUrl": "git@github.com:org/infrastructure.git",
        "authorEmail": "aura@company.com"
      },
      "argocd": {
        "server": "argocd-server.argocd.svc.cluster.local",
        "appName": "infrastructure"
      },
      "agent": {
        "planApprovalRequired": true,
        "destructiveActionApproval": true
      }
    }
```

## Validation

Configuration is validated on startup. Invalid configuration causes the server to exit with an error:

```
Configuration validation failed:
- llm.apiKey: must be a non-empty string
- git.repoUrl: must be a valid URL or SSH path
```

## Sensitive Values

Never commit sensitive values to configuration files. Use environment variables for:

- `AURA_LLM_API_KEY` - LLM API key
- `AURA_ARGOCD_TOKEN` - ArgoCD token
- `AURA_NTFY_TOKEN` - ntfy access token
- `AURA_DB_CONNECTION` - Database connection (if it contains password)

The `config/local.json` file is gitignored by default for local secrets.

## TUI Configuration

The TUI (Terminal User Interface) supports the following CLI options:

| Option | Description | Default |
|--------|-------------|---------|
| `-s, --server <url>` | Aura server URL (client mode) | `http://localhost:3000` |
| `--standalone` | Run with embedded server | `false` |
| `-c, --config <dir>` | Configuration directory (standalone mode) | `./config` |

### Client Mode

Connect to an existing Aura server:

```bash
# Default (localhost:3000)
node --experimental-strip-types src/tui/tui.ts

# Remote server
node --experimental-strip-types src/tui/tui.ts --server https://aura.example.com:3000
```

### Standalone Mode

Run with an embedded server using configuration files:

```bash
# Use default config directory
node --experimental-strip-types src/tui/tui.ts --standalone

# Use custom config directory
node --experimental-strip-types src/tui/tui.ts --standalone --config /path/to/config
```

In standalone mode, the TUI loads configuration from the specified directory using the same precedence rules as the server (default.json, {env}.json, local.json).
