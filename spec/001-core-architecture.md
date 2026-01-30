# Aura - AI-Driven Kubernetes Cluster Management

> An autonomous reliability engineer for your homelab Kubernetes cluster

## Vision

Aura is a ticket-based AI agent that manages Kubernetes clusters through GitOps. Users submit requests (deploy an app, debug an issue, configure networking), and Aura autonomously resolves them by modifying infrastructure-as-code, pushing to git, and monitoring ArgoCD until the cluster reaches a healthy state.

## Core Principles

1. **GitOps-First**: All cluster changes flow through git. The agent never applies changes directly to the cluster.
2. **Observable**: Full audit trail of every action, decision, and reasoning.
3. **Incremental**: Commits early and often with validations for easy rollback.
4. **Self-Documenting**: Maintains technical and operational knowledge in the repo.
5. **Human-in-the-Loop**: Escalates when uncertain, requires approval for destructive operations.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                           User Interface                             │
│                    (Fastify API + Zod Validation)                   │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Ticket System                                │
│              (Create, Plan, Execute, Escalate, Close)               │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      LangGraph Agent Core                           │
│                                                                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ │
│  │   Planner   │  │  Executor   │  │  Observer   │  │  Resolver  │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                                    │
            ┌───────────────────────┼───────────────────────┐
            ▼                       ▼                       ▼
┌───────────────────┐   ┌───────────────────┐   ┌───────────────────┐
│    Git Tools      │   │  Cluster Tools    │   │   Shell Tools     │
│   (simple-git)    │   │   (kubectl)       │   │  (app debugging)  │
└───────────────────┘   └───────────────────┘   └───────────────────┘
            │                       │
            ▼                       ▼
┌───────────────────┐   ┌───────────────────┐
│   Infrastructure  │   │   Kubernetes      │
│   Repo (cdk8s)    │   │   Cluster         │
│                   │   │   + ArgoCD        │
└───────────────────┘   └───────────────────┘
```

### Agent Context (Prompt Construction)

Every agent invocation includes this context automatically:

1. **System Prompt**: Base instructions, available tools, behavioral guidelines
2. **AGENTS.md**: Full contents of the repository's `AGENTS.md` file (cluster knowledge)
3. **Ticket Context**: Current ticket details, plan, and history
4. **Recent Audit Log**: Last N actions for continuity

```
┌─────────────────────────────────────────┐
│            Agent Prompt                 │
├─────────────────────────────────────────┤
│ [System Instructions]                   │
│ - Role: Kubernetes reliability engineer │
│ - Available tools and usage             │
│ - Behavioral guidelines                 │
├─────────────────────────────────────────┤
│ [AGENTS.md - Auto-loaded]               │
│ - Cluster overview                      │
│ - Documentation index                   │
│ - Critical knowledge                    │
│ - Conventions & known issues            │
├─────────────────────────────────────────┤
│ [Ticket Context]                        │
│ - Ticket ID, title, description         │
│ - Approved plan (if any)                │
│ - Current status and turn count         │
├─────────────────────────────────────────┤
│ [Recent Actions]                        │
│ - Last 10 audit log entries             │
│ - Provides continuity across turns      │
├─────────────────────────────────────────┤
│ [User Message / Current Task]           │
└─────────────────────────────────────────┘
```

## Technology Stack

| Component       | Technology        | Rationale                                           |
| --------------- | ----------------- | --------------------------------------------------- |
| Runtime         | Node.js 22+       | Native TypeScript via --experimental-strip-types    |
| Agent Framework | LangGraph         | Stateful agent workflows, tool orchestration        |
| LLM Provider    | OpenAI-compatible | Configurable baseURL for provider flexibility       |
| API Server      | Fastify           | Performance, schema validation, plugin ecosystem    |
| Validation      | Zod               | Runtime type safety, API schema generation          |
| Configuration   | Convict           | Schema-based config, env vars, validation, defaults |
| Database        | Knex              | SQLite (dev/single-node) + PostgreSQL (production)  |
| Git Operations  | simple-git        | Mature, Promise-based git interface                 |
| IaC Generation  | cdk8s             | Type-safe K8s manifests, schema validation          |
| GitOps          | ArgoCD            | Industry standard, health tracking, auto-sync       |
| Secrets         | Sealed Secrets    | Encrypt secrets for git storage                     |
| Notifications   | ntfy.sh           | Simple, self-hostable (extensible architecture)     |
| Distribution    | Docker            | Containerized deployment, easy installation         |

## Data Model

### Core Entities

```typescript
// Ticket - The primary unit of work
interface Ticket {
  id: string; // UUID
  title: string;
  description: string;
  status: TicketStatus;
  priority: Priority;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;

  // Planning phase
  plan?: TicketPlan;
  planApprovedAt?: Date;
  planApprovedBy?: string;

  // Execution tracking
  currentTurn: number;
  maxTurns: number;
  tokenUsage: TokenUsage;

  // Human-in-the-loop
  pendingApproval?: ApprovalRequest;
  pendingQuestion?: Question;

  // Git tracking
  workingBranch?: string;
  commits: string[]; // Commit SHAs for this ticket
}

enum TicketStatus {
  DRAFT = 'draft', // Initial creation, gathering info
  PLANNING = 'planning', // Agent formulating approach
  PENDING_PLAN_APPROVAL = 'pending_plan_approval',
  EXECUTING = 'executing', // Agent working on resolution
  PENDING_APPROVAL = 'pending_approval', // Needs human approval for action
  PENDING_INPUT = 'pending_input', // Needs human to answer question
  OBSERVING = 'observing', // Waiting for ArgoCD sync
  PAUSED = 'paused', // Max turns reached, human decision needed
  RESOLVED = 'resolved',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

// Audit Log - Complete history of ticket activity
interface AuditLogEntry {
  id: string;
  ticketId: string;
  timestamp: Date;
  type: AuditEventType;
  actor: 'agent' | 'user' | 'system';

  // Event details
  action: string;
  reasoning?: string; // Agent's reasoning for this action
  toolCall?: ToolCallRecord;
  stateChange?: StateChange;

  // Cost tracking
  tokenUsage?: TokenUsage;
}

enum AuditEventType {
  TICKET_CREATED = 'ticket_created',
  STATUS_CHANGED = 'status_changed',
  PLAN_GENERATED = 'plan_generated',
  PLAN_APPROVED = 'plan_approved',
  TOOL_CALLED = 'tool_called',
  COMMIT_CREATED = 'commit_created',
  PUSH_EXECUTED = 'push_executed',
  ARGO_SYNC_STARTED = 'argo_sync_started',
  ARGO_HEALTH_CHECKED = 'argo_health_checked',
  APPROVAL_REQUESTED = 'approval_requested',
  APPROVAL_GRANTED = 'approval_granted',
  APPROVAL_DENIED = 'approval_denied',
  QUESTION_ASKED = 'question_asked',
  QUESTION_ANSWERED = 'question_answered',
  ERROR_OCCURRED = 'error_occurred',
  TICKET_RESOLVED = 'ticket_resolved',
}

interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost?: number; // USD, based on model pricing
}

// Agent State - Persisted between turns
interface AgentState {
  ticketId: string;
  currentPhase: AgentPhase;
  memory: AgentMemory;
  pendingActions: PendingAction[];
  lastCheckpoint: Date;
}
```

### Database Schema

```sql
-- Core tables
CREATE TABLE tickets (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMP,
  plan JSONB,
  plan_approved_at TIMESTAMP,
  plan_approved_by TEXT,
  current_turn INTEGER NOT NULL DEFAULT 0,
  max_turns INTEGER NOT NULL DEFAULT 50,
  token_usage JSONB NOT NULL DEFAULT '{"promptTokens":0,"completionTokens":0,"totalTokens":0}',
  pending_approval JSONB,
  pending_question JSONB,
  working_branch TEXT,
  commits TEXT[] DEFAULT '{}'
);

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES tickets(id),
  timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  type TEXT NOT NULL,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  reasoning TEXT,
  tool_call JSONB,
  state_change JSONB,
  token_usage JSONB
);

CREATE TABLE agent_states (
  ticket_id UUID PRIMARY KEY REFERENCES tickets(id),
  current_phase TEXT NOT NULL,
  memory JSONB NOT NULL,
  pending_actions JSONB NOT NULL DEFAULT '[]',
  last_checkpoint TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Knowledge base (repo documentation index)
CREATE TABLE knowledge_entries (
  id UUID PRIMARY KEY,
  path TEXT NOT NULL,           -- Path in repo
  type TEXT NOT NULL,           -- 'technical' | 'operational' | 'runbook'
  title TEXT NOT NULL,
  summary TEXT,
  last_updated TIMESTAMP NOT NULL,
  updated_by_ticket UUID REFERENCES tickets(id)
);

-- Indexes
CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_audit_logs_ticket ON audit_logs(ticket_id);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);
```

## Ticket Lifecycle

```
                    ┌──────────────────┐
                    │      DRAFT       │ ◄── User creates ticket
                    └────────┬─────────┘
                             │ Agent starts planning
                             ▼
                    ┌──────────────────┐
                    │    PLANNING      │ ◄── Agent analyzes, formulates approach
                    └────────┬─────────┘
                             │ Plan ready
                             ▼
                    ┌──────────────────┐
             ┌─────►│ PENDING_PLAN_    │ ◄── User reviews plan
             │      │    APPROVAL      │
             │      └────────┬─────────┘
             │               │ Approved
             │               ▼
             │      ┌──────────────────┐
             │ ┌───►│    EXECUTING     │◄─────────────────────────┐
             │ │    └────────┬─────────┘                          │
             │ │             │                                     │
             │ │    ┌────────┴─────────┬──────────────┐           │
             │ │    ▼                  ▼              ▼           │
             │ │ ┌──────────┐  ┌─────────────┐  ┌──────────┐     │
             │ │ │ PENDING_ │  │  PENDING_   │  │OBSERVING │     │
             │ │ │ APPROVAL │  │   INPUT     │  │(ArgoCD)  │     │
             │ │ └────┬─────┘  └──────┬──────┘  └────┬─────┘     │
             │ │      │               │              │            │
             │ │      │ Approved      │ Answered     │ Healthy    │
             │ │      └───────────────┴──────────────┴────────────┘
             │ │
             │ │      Max turns reached
             │ │             │
             │ │             ▼
             │ │    ┌──────────────────┐
             │ └────┤      PAUSED      │ ◄── Human decides: more turns or close
             │      └────────┬─────────┘
             │               │
    Revise   │               │ Close/Cancel
    plan     │               ▼
             │      ┌──────────────────┐
             └──────┤    RESOLVED /    │
                    │ FAILED/CANCELLED │
                    └──────────────────┘
```

## Agent Tools

### Git Operations (Mutating)

| Tool                  | Description                                                      |
| --------------------- | ---------------------------------------------------------------- |
| `git_clone_worktree`  | Clone/setup worktree for ticket's working branch                 |
| `git_checkout_branch` | Create or switch to ticket branch                                |
| `git_commit`          | Commit staged changes with message (runs pre-commit validations) |
| `git_push`            | Push current branch to remote                                    |
| `git_rebase`          | Rebase current branch onto target                                |
| `git_read_file`       | Read file contents from repo                                     |
| `git_write_file`      | Write/update file in repo                                        |
| `git_delete_file`     | Remove file from repo                                            |

### Infrastructure (via cdk8s)

| Tool             | Description                                 |
| ---------------- | ------------------------------------------- |
| `cdk8s_synth`    | Synthesize cdk8s constructs to YAML         |
| `cdk8s_validate` | Validate generated manifests                |
| `cdk8s_diff`     | Show diff between current and new manifests |

### Cluster Inspection (Read-only)

| Tool               | Description                                       |
| ------------------ | ------------------------------------------------- |
| `kubectl_get`      | Get resources (pods, services, deployments, etc.) |
| `kubectl_describe` | Detailed resource information                     |
| `kubectl_logs`     | Container logs                                    |
| `kubectl_events`   | Cluster events                                    |
| `kubectl_top`      | Resource usage (CPU/memory)                       |

### ArgoCD

| Tool                | Description                                |
| ------------------- | ------------------------------------------ |
| `argo_app_list`     | List ArgoCD applications                   |
| `argo_app_get`      | Get application details and sync status    |
| `argo_app_sync`     | Trigger sync for application               |
| `argo_app_wait`     | Wait for application to reach target state |
| `argo_app_history`  | Get deployment history                     |
| `argo_app_rollback` | Rollback to previous revision              |

### Sealed Secrets

| Tool                   | Description                   |
| ---------------------- | ----------------------------- |
| `sealed_secret_create` | Create a new sealed secret    |
| `sealed_secret_update` | Update existing sealed secret |

### Shell Execution (Controlled)

| Tool              | Description                                     |
| ----------------- | ----------------------------------------------- |
| `shell_exec`      | Execute shell command (for app-level debugging) |
| `kubectl_exec`    | Execute command in pod                          |
| `kubectl_run_job` | Create and run a Job for complex operations     |

### Documentation

| Tool               | Description                             |
| ------------------ | --------------------------------------- |
| `doc_read`         | Read full documentation file from repo  |
| `doc_write`        | Create/update documentation file        |
| `doc_list`         | List documentation files in a directory |
| `agents_md_update` | Update a specific section in AGENTS.md  |

Note: Documentation tools always read/write full files to ensure complete context. Files in infrastructure repos are expected to be reasonably sized.

### Human Interaction

| Tool               | Description                       |
| ------------------ | --------------------------------- |
| `request_approval` | Request human approval for action |
| `ask_question`     | Ask user for clarification        |
| `notify_user`      | Send notification via ntfy.sh     |

## GitOps Workflow

### Branch Strategy

```
main (protected)
  │
  ├── aura/ticket-{id}     ◄── Agent works here
  │     │
  │     └── Commits with validations
  │
  └── (merge on resolution)
```

### Commit Flow

1. Agent creates branch `aura/ticket-{ticket_id}`
2. Makes changes via cdk8s
3. **Pre-commit validations run automatically**:
   - cdk8s synth (generates YAML)
   - cdk8s validate (schema validation)
   - YAML lint
   - Kubernetes dry-run if configured
4. Commit with descriptive message + ticket reference
5. Push to remote
6. ArgoCD detects changes (if configured for branch) OR agent updates ArgoCD app target revision
7. Agent monitors ArgoCD sync status
8. On success: merge to main, delete working branch
9. On failure: analyze, iterate, or escalate

### ArgoCD Integration Options

**Option A: Direct branch deployment**

- ArgoCD app points to agent's working branch during execution
- Agent updates `targetRevision` in ArgoCD Application spec
- On resolution, merge to main, reset targetRevision

**Option B: Preview environments**

- Each ticket branch gets its own ArgoCD Application
- Useful for testing changes in isolation
- Cleanup on ticket resolution

**Recommended: Option A** for simplicity in homelab context.

## Pre-Push Validations

Automatic validations before any push:

1. **Schema Validation** (cdk8s)
   - All constructs must synthesize without errors
   - Generated YAML must be valid Kubernetes specs

2. **Lint Checks**
   - YAML formatting
   - Kubernetes best practices (via kube-linter or similar)

3. **Dry-run Validation** (optional, configurable)
   - `kubectl apply --dry-run=server`
   - Catches issues that schema validation misses

4. **Secret Detection**
   - Scan for accidentally committed secrets
   - Ensure all secrets use SealedSecrets

5. **Documentation**
   - Require doc updates for significant changes (configurable)

## Configuration

Configuration is managed via [Convict](https://github.com/mozilla/node-convict), providing:

- Schema-based validation with defaults
- Environment variable mapping
- Type coercion
- Hierarchical configuration files

### Configuration Schema

```typescript
import convict from 'convict';

const config = convict({
  env: {
    doc: 'The application environment',
    format: ['production', 'development', 'test'],
    default: 'development',
    env: 'NODE_ENV',
  },

  // LLM Configuration
  llm: {
    baseUrl: {
      doc: 'OpenAI-compatible API endpoint',
      format: 'url',
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
      format: 'nat',
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

  // Database
  database: {
    client: {
      doc: 'Database client type',
      format: ['sqlite3', 'pg'],
      default: 'sqlite3',
      env: 'AURA_DB_CLIENT',
    },
    connection: {
      doc: 'Database connection string or path',
      format: String,
      default: './data/aura.db',
      env: 'AURA_DB_CONNECTION',
    },
  },

  // Git Repository
  git: {
    repoUrl: {
      doc: 'Infrastructure repository URL',
      format: String,
      default: '',
      env: 'AURA_GIT_REPO_URL',
    },
    branch: {
      doc: 'Main branch name',
      format: String,
      default: 'main',
      env: 'AURA_GIT_BRANCH',
    },
    workingDir: {
      doc: 'Local working directory for git operations',
      format: String,
      default: './workspace',
      env: 'AURA_GIT_WORKING_DIR',
    },
    authorName: {
      doc: 'Git commit author name',
      format: String,
      default: 'Aura Agent',
      env: 'AURA_GIT_AUTHOR_NAME',
    },
    authorEmail: {
      doc: 'Git commit author email',
      format: 'email',
      default: 'aura@localhost',
      env: 'AURA_GIT_AUTHOR_EMAIL',
    },
  },

  // Kubernetes
  kubernetes: {
    context: {
      doc: 'kubectl context to use (empty for default)',
      format: String,
      default: '',
      env: 'AURA_K8S_CONTEXT',
    },
    namespace: {
      doc: 'Default namespace (empty for all)',
      format: String,
      default: '',
      env: 'AURA_K8S_NAMESPACE',
    },
  },

  // ArgoCD
  argocd: {
    server: {
      doc: 'ArgoCD server address',
      format: String,
      default: 'argocd-server.argocd.svc.cluster.local',
      env: 'AURA_ARGOCD_SERVER',
    },
    token: {
      doc: 'ArgoCD API token (optional if using kubeconfig)',
      format: String,
      default: '',
      env: 'AURA_ARGOCD_TOKEN',
      sensitive: true,
    },
    appName: {
      doc: 'Main ArgoCD application name',
      format: String,
      default: 'infrastructure',
      env: 'AURA_ARGOCD_APP_NAME',
    },
  },

  // Sealed Secrets
  sealedSecrets: {
    controllerNamespace: {
      doc: 'Sealed Secrets controller namespace',
      format: String,
      default: 'kube-system',
      env: 'AURA_SEALED_SECRETS_NAMESPACE',
    },
    controllerName: {
      doc: 'Sealed Secrets controller name',
      format: String,
      default: 'sealed-secrets-controller',
      env: 'AURA_SEALED_SECRETS_CONTROLLER',
    },
  },

  // Notifications
  notifications: {
    provider: {
      doc: 'Notification provider',
      format: ['ntfy', 'none'],
      default: 'none',
      env: 'AURA_NOTIFY_PROVIDER',
    },
    ntfy: {
      server: {
        doc: 'ntfy server URL',
        format: 'url',
        default: 'https://ntfy.sh',
        env: 'AURA_NTFY_SERVER',
      },
      topic: {
        doc: 'ntfy topic name',
        format: String,
        default: 'aura',
        env: 'AURA_NTFY_TOPIC',
      },
      token: {
        doc: 'ntfy access token (optional)',
        format: String,
        default: '',
        env: 'AURA_NTFY_TOKEN',
        sensitive: true,
      },
    },
  },

  // Agent Behavior
  agent: {
    defaultMaxTurns: {
      doc: 'Default maximum turns per ticket',
      format: 'nat',
      default: 50,
      env: 'AURA_AGENT_MAX_TURNS',
    },
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
    autoMergeOnResolution: {
      doc: 'Auto-merge to main on ticket resolution',
      format: Boolean,
      default: true,
      env: 'AURA_AGENT_AUTO_MERGE',
    },
  },

  // API Server
  server: {
    host: {
      doc: 'Server bind address',
      format: String,
      default: '0.0.0.0',
      env: 'AURA_SERVER_HOST',
    },
    port: {
      doc: 'Server port',
      format: 'port',
      default: 3000,
      env: 'AURA_SERVER_PORT',
    },
  },

  // Cost Tracking
  costTracking: {
    enabled: {
      doc: 'Enable cost tracking',
      format: Boolean,
      default: true,
      env: 'AURA_COST_TRACKING_ENABLED',
    },
    promptPricePer1k: {
      doc: 'Price per 1K prompt tokens (USD)',
      format: Number,
      default: 0.01,
      env: 'AURA_COST_PROMPT_PRICE',
    },
    completionPricePer1k: {
      doc: 'Price per 1K completion tokens (USD)',
      format: Number,
      default: 0.03,
      env: 'AURA_COST_COMPLETION_PRICE',
    },
  },
});
```

### Configuration Files

Convict loads configuration in order (later sources override earlier):

1. Schema defaults
2. `config/default.json` - Base configuration
3. `config/{env}.json` - Environment-specific (development.json, production.json)
4. Environment variables
5. `config/local.json` - Local overrides (gitignored)

### Example Configuration File

```json
{
  "llm": {
    "model": "gpt-4-turbo",
    "temperature": 0.1
  },
  "database": {
    "client": "pg",
    "connection": "postgresql://aura:password@localhost:5432/aura"
  },
  "git": {
    "repoUrl": "git@github.com:myorg/infrastructure.git",
    "authorEmail": "aura@myorg.com"
  },
  "argocd": {
    "server": "argocd.mylab.local",
    "appName": "homelab"
  },
  "notifications": {
    "provider": "ntfy",
    "ntfy": {
      "topic": "homelab-aura"
    }
  }
}
```

### Environment Variables Reference

| Variable               | Description                | Default                     |
| ---------------------- | -------------------------- | --------------------------- |
| `AURA_LLM_BASE_URL`    | OpenAI-compatible endpoint | `https://api.openai.com/v1` |
| `AURA_LLM_API_KEY`     | LLM API key                | (required)                  |
| `AURA_LLM_MODEL`       | Model identifier           | `gpt-4-turbo`               |
| `AURA_DB_CLIENT`       | Database type              | `sqlite3`                   |
| `AURA_DB_CONNECTION`   | Database connection        | `./data/aura.db`            |
| `AURA_GIT_REPO_URL`    | Infrastructure repo        | (required)                  |
| `AURA_SERVER_PORT`     | API server port            | `3000`                      |
| `AURA_NOTIFY_PROVIDER` | Notification provider      | `none`                      |

See schema above for complete list.

## API Endpoints

### Tickets

```
POST   /api/tickets              Create new ticket
GET    /api/tickets              List tickets (with filters)
GET    /api/tickets/:id          Get ticket details
PATCH  /api/tickets/:id          Update ticket
DELETE /api/tickets/:id          Cancel ticket

POST   /api/tickets/:id/approve-plan    Approve ticket plan
POST   /api/tickets/:id/approve         Approve pending action
POST   /api/tickets/:id/answer          Answer pending question
POST   /api/tickets/:id/resume          Resume paused ticket (grant more turns)
POST   /api/tickets/:id/cancel          Cancel ticket
```

### Streaming (Server-Sent Events)

```
GET    /api/tickets/:id/stream    Subscribe to ticket events
GET    /api/stream                Subscribe to all ticket events (with filters)
```

#### Ticket Stream Events

Connect via SSE to receive real-time updates:

```typescript
// Client example
const eventSource = new EventSource('/api/tickets/123/stream');

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log(data.type, data.payload);
};
```

#### Event Types

| Event                | Description                    | Payload                       |
| -------------------- | ------------------------------ | ----------------------------- |
| `connected`          | Initial connection established | `{ ticketId, currentStatus }` |
| `status_changed`     | Ticket status transition       | `{ from, to, reason }`        |
| `turn_started`       | Agent began a new turn         | `{ turn, maxTurns }`          |
| `turn_completed`     | Agent finished a turn          | `{ turn, tokenUsage }`        |
| `tool_called`        | Agent invoked a tool           | `{ tool, args, result? }`     |
| `plan_generated`     | Plan ready for review          | `{ plan }`                    |
| `approval_needed`    | Human approval required        | `{ action, reason }`          |
| `question_asked`     | Agent needs input              | `{ question }`                |
| `commit_created`     | Git commit made                | `{ sha, message }`            |
| `push_completed`     | Pushed to remote               | `{ branch, sha }`             |
| `argo_sync_started`  | ArgoCD sync triggered          | `{ app, revision }`           |
| `argo_health_update` | ArgoCD health changed          | `{ app, health, status }`     |
| `error`              | Error occurred                 | `{ message, recoverable }`    |
| `resolved`           | Ticket completed               | `{ summary, tokenUsage }`     |
| `heartbeat`          | Keep-alive (every 30s)         | `{ timestamp }`               |

#### Event Payload Format

```typescript
interface StreamEvent {
  id: string; // Event ID for resumption
  type: EventType;
  timestamp: string; // ISO 8601
  ticketId: string;
  payload: Record<string, unknown>;
}
```

#### Resumption Support

Include `Last-Event-ID` header to resume from a specific event:

```
GET /api/tickets/:id/stream
Last-Event-ID: evt_abc123
```

The server will replay any events that occurred after the specified ID.

#### Global Stream Filters

The global stream endpoint supports query parameters:

```
GET /api/stream?status=executing,observing&priority=high
```

### Audit

```
GET    /api/tickets/:id/audit    Get audit log for ticket
GET    /api/audit                Global audit log (with filters)
```

### Cluster (Proxy/Read-only)

```
GET    /api/cluster/namespaces
GET    /api/cluster/pods
GET    /api/cluster/services
GET    /api/cluster/deployments
GET    /api/cluster/events
```

### ArgoCD (Proxy)

```
GET    /api/argo/apps
GET    /api/argo/apps/:name
POST   /api/argo/apps/:name/sync
```

### Health & Info

```
GET    /api/health
GET    /api/info                 Version, config summary
GET    /api/stats                Token usage, ticket stats
```

## Repository Documentation Structure

The agent maintains documentation in the infrastructure repo:

```
AGENTS.md                        # Agent context file (always loaded)
docs/
├── technical/
│   ├── architecture.md         # Overall cluster architecture
│   ├── networking.md           # Network topology, ingress config
│   ├── storage.md              # Storage classes, PVs
│   └── services/
│       └── {service-name}.md   # Per-service technical docs
├── operational/
│   ├── runbooks/
│   │   ├── common-issues.md
│   │   └── {issue-type}.md
│   ├── maintenance/
│   │   └── scheduled-tasks.md
│   └── incidents/
│       └── {date}-{summary}.md # Post-incident learnings
└── knowledge/
    ├── decisions.md            # ADRs (Architecture Decision Records)
    └── lessons-learned.md      # Agent's accumulated knowledge
```

### AGENTS.md - Agent Context File

The `AGENTS.md` file at the repository root is **always loaded into the agent's context** at the start of every session. It serves as:

1. **Documentation Index**: Quick reference to what documentation exists and where
2. **Critical Knowledge**: Important facts the agent must always remember
3. **Cluster Overview**: High-level architecture and key components
4. **Conventions**: Naming patterns, directory structure, deployment standards
5. **Known Issues**: Gotchas and workarounds the agent has discovered
6. **Operational Notes**: Critical procedures that must be followed

The agent is responsible for keeping this file up-to-date as it learns about the cluster.

#### AGENTS.md Structure

```markdown
# Cluster: {cluster-name}

## Overview

Brief description of the cluster's purpose and architecture.

## Quick Reference

- ArgoCD UI: https://argocd.example.com
- Main namespace: production
- Ingress controller: nginx

## Documentation Index

| Topic        | Location                       | Summary                    |
| ------------ | ------------------------------ | -------------------------- |
| Architecture | docs/technical/architecture.md | Overall system design      |
| Networking   | docs/technical/networking.md   | Ingress, DNS, certificates |
| ...          | ...                            | ...                        |

## Critical Knowledge

Things the agent must always remember:

- Database backups run at 3am UTC - never schedule maintenance then
- The `legacy-api` deployment must stay on node `worker-2` (GPU required)
- Always update `docs/services/{name}.md` when deploying new services

## Conventions

- Namespaces: `{team}-{env}` (e.g., `platform-prod`)
- Secrets: Always use SealedSecrets, never plain Secrets
- Labels: All resources must have `app`, `team`, `env` labels

## Known Issues & Workarounds

| Issue                                     | Workaround           | Ticket |
| ----------------------------------------- | -------------------- | ------ |
| Cert-manager sometimes fails on first try | Retry sync in ArgoCD | #142   |

## Recent Changes

Last 5 significant changes (auto-maintained by agent):

- 2024-01-15: Upgraded ingress-nginx to v1.9.0 (#187)
- 2024-01-10: Added monitoring namespace (#183)
- ...
```

#### Agent Instructions for AGENTS.md

The agent should update AGENTS.md when:

- It discovers important information about the cluster
- It encounters and solves a non-obvious problem
- Documentation is added or significantly changed
- Conventions or patterns are established
- A gotcha or workaround is discovered

Updates should be atomic and focused - use the `agents_md_update` tool to modify specific sections rather than rewriting the entire file.

## Deployment

### Docker Container

Aura is distributed as a Docker container for easy deployment in homelab environments.

#### Dockerfile

```dockerfile
FROM node:22-slim

WORKDIR /app

# Install runtime dependencies (kubectl, git, kubeseal)
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    ca-certificates \
    && curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl" \
    && chmod +x kubectl && mv kubectl /usr/local/bin/ \
    && curl -LO "https://github.com/bitnami-labs/sealed-secrets/releases/download/v0.24.0/kubeseal-0.24.0-linux-amd64.tar.gz" \
    && tar -xzf kubeseal-0.24.0-linux-amd64.tar.gz && mv kubeseal /usr/local/bin/ \
    && rm -rf /var/lib/apt/lists/* kubeseal-0.24.0-linux-amd64.tar.gz

# Enable corepack for pnpm
RUN corepack enable

# Copy package files and install dependencies
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy source
COPY . .

# Create directories for data and workspace
RUN mkdir -p /data /workspace /config

# Default environment
ENV NODE_ENV=production
ENV AURA_DATABASE_FILENAME=/data/aura.db
ENV AURA_GIT_WORKING_DIR=/workspace

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["node", "--experimental-strip-types", "src/main.ts"]
```

#### Docker Compose

```yaml
version: '3.8'

services:
  aura:
    image: ghcr.io/your-org/aura:latest
    container_name: aura
    restart: unless-stopped
    ports:
      - '3000:3000'
    environment:
      - AURA_LLM_API_KEY=${AURA_LLM_API_KEY}
      - AURA_GIT_REPO_URL=${AURA_GIT_REPO_URL}
      - AURA_ARGOCD_SERVER=${AURA_ARGOCD_SERVER}
      - AURA_NTFY_TOPIC=${AURA_NTFY_TOPIC:-aura}
    volumes:
      # Persistent data
      - aura-data:/data
      # Git workspace (can be tmpfs for ephemeral)
      - aura-workspace:/workspace
      # Custom configuration
      - ./config:/config:ro
      # Kubeconfig for cluster access
      - ~/.kube:/root/.kube:ro
      # SSH keys for git (if using SSH)
      - ~/.ssh:/root/.ssh:ro
    networks:
      - aura

  # Optional: PostgreSQL for production
  postgres:
    image: postgres:16-alpine
    container_name: aura-postgres
    restart: unless-stopped
    environment:
      - POSTGRES_USER=aura
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
      - POSTGRES_DB=aura
    volumes:
      - aura-postgres:/var/lib/postgresql/data
    networks:
      - aura
    profiles:
      - postgres

volumes:
  aura-data:
  aura-workspace:
  aura-postgres:

networks:
  aura:
```

#### Kubernetes Deployment

For running Aura inside the cluster it manages:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: aura
  namespace: aura-system
spec:
  replicas: 1
  selector:
    matchLabels:
      app: aura
  template:
    metadata:
      labels:
        app: aura
    spec:
      serviceAccountName: aura
      containers:
        - name: aura
          image: ghcr.io/your-org/aura:latest
          ports:
            - containerPort: 3000
          env:
            - name: AURA_LLM_API_KEY
              valueFrom:
                secretKeyRef:
                  name: aura-secrets
                  key: llm-api-key
            - name: AURA_GIT_REPO_URL
              valueFrom:
                configMapKeyRef:
                  name: aura-config
                  key: git-repo-url
            - name: AURA_DATABASE_CLIENT
              value: pg
            - name: AURA_DATABASE_HOST
              valueFrom:
                secretKeyRef:
                  name: aura-secrets
                  key: database-host
          volumeMounts:
            - name: workspace
              mountPath: /workspace
            - name: ssh-keys
              mountPath: /root/.ssh
              readOnly: true
          resources:
            requests:
              memory: '256Mi'
              cpu: '100m'
            limits:
              memory: '1Gi'
              cpu: '1000m'
          livenessProbe:
            httpGet:
              path: /api/health
              port: 3000
            initialDelaySeconds: 10
            periodSeconds: 30
          readinessProbe:
            httpGet:
              path: /api/health
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 10
      volumes:
        - name: workspace
          emptyDir: {}
        - name: ssh-keys
          secret:
            secretName: aura-ssh-keys
            defaultMode: 0400
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: aura
  namespace: aura-system
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: aura-cluster-admin
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: cluster-admin # Full access for reliability engineer
subjects:
  - kind: ServiceAccount
    name: aura
    namespace: aura-system
```

### Volume Mounts

| Mount         | Purpose                      | Notes                         |
| ------------- | ---------------------------- | ----------------------------- |
| `/data`       | SQLite database, agent state | Persistent volume required    |
| `/workspace`  | Git working directory        | Can be ephemeral (emptyDir)   |
| `/config`     | Configuration overrides      | Optional, read-only           |
| `/root/.kube` | Kubernetes config            | Required for cluster access   |
| `/root/.ssh`  | SSH keys                     | Required if using SSH for git |

### Required Secrets

When deploying, ensure these secrets are configured:

1. **LLM API Key**: `AURA_LLM_API_KEY`
2. **Git SSH Key**: Mount at `/root/.ssh/id_rsa` (or configure git credential helper)
3. **ArgoCD Token**: `AURA_ARGOCD_TOKEN` (if not using in-cluster auth)
4. **Database Password**: If using PostgreSQL

## Future Enhancements (Out of Scope for v1)

1. **Proactive Health Monitoring**
   - Watch cluster health metrics
   - Auto-create tickets for detected issues
   - Self-healing for known patterns

2. **Multi-cluster Support**
   - Manage multiple clusters from single Aura instance
   - Cross-cluster operations

3. **Advanced Notifications**
   - Slack, Discord, Email providers
   - Webhook support

4. **TUI/CLI Interface**
   - Interactive terminal interface
   - Real-time ticket progress

5. **Permission Scoping**
   - Namespace restrictions
   - Resource type whitelist
   - RBAC-like policies for agent

6. **Secret Handling UI**
   - User provides secrets without agent exposure
   - Secure secret input workflow

7. **Automatic Rollback**
   - Configurable health check timeout
   - Auto-revert on persistent unhealthy state

8. **Approval Workflows**
   - Tool-level restrictions
   - Required approvals for specific resource types

9. **Cost Optimization**
   - Token usage analysis
   - Prompt optimization suggestions

10. **Multi-agent Collaboration**
    - Specialist agents for specific domains
    - Agent handoff for complex tickets

---

## Getting Started (Implementation Phases)

### Phase 1: Foundation ✓

- [x] Project setup (Node.js 22+, TypeScript config)
- [x] Database schema + Knex setup (SQLite + PostgreSQL)
- [x] Basic Fastify server with Zod validation
- [x] Configuration management (Convict)
- [x] Service container (DI)
- [x] Ticket system with CRUD + status transitions
- [x] Audit logging
- [x] SSE streaming endpoint

### Phase 2: Git & Infrastructure

- [x] simple-git integration
- [x] cdk8s setup and basic constructs
- [x] Pre-commit validation pipeline

### Phase 3: Agent Core

- [x] LangGraph setup with OpenAI
- [x] Basic tool definitions
- [x] Agent state management

### Phase 4: Ticket System ✓ (completed in Phase 1)

- [x] CRUD operations
- [x] Status transitions
- [x] Audit logging

### Phase 5: Cluster Integration

- [x] kubectl wrapper tools
- [x] ArgoCD integration
- [x] Sealed Secrets tools

### Phase 6: Agent Intelligence

- [x] Planning phase implementation
- [x] Execution loop
- [x] Human-in-the-loop workflows

### Phase 7: Polish

- [ ] Notifications (ntfy.sh)
- [ ] Cost tracking
- [ ] Documentation tools
- [ ] Error handling & recovery

---

_Aura - Your AI reliability engineer that never sleeps._
