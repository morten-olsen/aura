# Aura

> An autonomous AI reliability engineer for your homelab Kubernetes cluster

Aura is a ticket-based AI agent that manages Kubernetes clusters through GitOps. Submit requests (deploy an app, debug an issue, configure networking), and Aura autonomously resolves them by modifying infrastructure-as-code, pushing to git, and monitoring ArgoCD until the cluster reaches a healthy state.

## Features

- **GitOps-First**: All cluster changes flow through git. The agent never applies changes directly to the cluster.
- **Observable**: Full audit trail of every action, decision, and reasoning.
- **Incremental**: Commits early and often with validations for easy rollback.
- **Self-Documenting**: Maintains technical and operational knowledge in the repo.
- **Human-in-the-Loop**: Escalates when uncertain, requires approval for destructive operations.

## Quick Start

### Prerequisites

- Node.js 22.6.0+ (uses native TypeScript via `--experimental-strip-types`)
- pnpm
- A Kubernetes cluster with ArgoCD
- An infrastructure repository using cdk8s

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/aura.git
cd aura

# Install dependencies
pnpm install

# Copy example config
cp config/example.json config/local.json
```

### Configuration

Edit `config/local.json` with your settings:

```json
{
  "llm": {
    "baseUrl": "https://api.openai.com/v1",
    "model": "gpt-4-turbo"
  },
  "git": {
    "repoUrl": "git@github.com:your-org/infrastructure.git"
  },
  "argocd": {
    "server": "argocd.your-cluster.local"
  }
}
```

Set required environment variables:

```bash
export AURA_LLM_API_KEY="your-openai-api-key"
```

### Running

```bash
# Development mode (with watch)
pnpm dev

# Production mode
pnpm start
```

The API server starts at `http://localhost:3000`.

## How It Works

```
User creates ticket    Agent plans approach    User approves plan
        │                      │                      │
        ▼                      ▼                      ▼
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│   "Deploy    │ ──▶  │  Analyze     │ ──▶  │  1. Create   │
│    Redis     │      │  cluster &   │      │     namespace│
│   cluster"   │      │  formulate   │      │  2. Generate │
│              │      │  plan        │      │     manifests│
└──────────────┘      └──────────────┘      └──────────────┘
                                                   │
                         Agent executes            │
        ┌──────────────────────────────────────────┘
        ▼
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│  Modify      │ ──▶  │  Push to     │ ──▶  │  Monitor     │
│  cdk8s       │      │  git         │      │  ArgoCD      │
│  constructs  │      │              │      │  sync        │
└──────────────┘      └──────────────┘      └──────────────┘
                                                   │
                                                   ▼
                                           ┌──────────────┐
                                           │  Ticket      │
                                           │  Resolved    │
                                           └──────────────┘
```

## API

### Tickets

```bash
# Create a ticket
curl -X POST http://localhost:3000/api/tickets \
  -H "Content-Type: application/json" \
  -d '{"title": "Deploy Redis", "description": "Deploy a 3-node Redis cluster"}'

# List tickets
curl http://localhost:3000/api/tickets

# Get ticket details
curl http://localhost:3000/api/tickets/{id}

# Approve a plan
curl -X POST http://localhost:3000/api/tickets/{id}/approve-plan
```

### Real-time Updates (SSE)

```bash
# Subscribe to ticket events
curl -N http://localhost:3000/api/tickets/{id}/stream
```

### Health

```bash
curl http://localhost:3000/api/health
```

## TUI (Terminal User Interface)

Aura includes an interactive terminal interface for managing tickets and monitoring agent activity.

### Client Mode

Connect to a running Aura server:

```bash
# Connect to local server (default)
node --experimental-strip-types src/tui/tui.ts

# Connect to remote server
node --experimental-strip-types src/tui/tui.ts --server https://aura.example.com
```

### Standalone Mode

Run with an embedded server (no external server required):

```bash
# Using default config
node --experimental-strip-types src/tui/tui.ts --standalone

# With custom config directory
node --experimental-strip-types src/tui/tui.ts --standalone --config ./config
```

### Keyboard Shortcuts

| Key | Dashboard | Ticket Detail |
|-----|-----------|---------------|
| `↑/↓` | Navigate tickets | Scroll content |
| `Enter` | View ticket | - |
| `n` | Create ticket | - |
| `s` | Start agent | Start agent |
| `p` | - | Approve plan |
| `y/n` | - | Grant/deny approval |
| `r` | Refresh | Refresh |
| `Esc/b` | Quit | Go back |
| `?` | Help | Help |

## Architecture

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

## Configuration Reference

Configuration is managed via Convict with the following sources (in order of precedence):

1. Schema defaults
2. `config/default.json`
3. `config/{NODE_ENV}.json`
4. Environment variables
5. `config/local.json` (gitignored)

### Environment Variables

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

See [spec/001-core-architecture.md](spec/001-core-architecture.md) for the complete configuration schema.

## Deployment

### Docker

```bash
docker run -d \
  -p 3000:3000 \
  -e AURA_LLM_API_KEY=$AURA_LLM_API_KEY \
  -e AURA_GIT_REPO_URL=git@github.com:your-org/infra.git \
  -v aura-data:/data \
  -v ~/.kube:/root/.kube:ro \
  -v ~/.ssh:/root/.ssh:ro \
  ghcr.io/your-org/aura:latest
```

### Docker Compose

```bash
cp docker-compose.yml docker-compose.override.yml
# Edit docker-compose.override.yml with your settings
docker compose up -d
```

### Kubernetes

See [spec/001-core-architecture.md](spec/001-core-architecture.md) for Kubernetes deployment manifests.

## Development

```bash
# Run in development mode with file watching
pnpm dev

# Run tests
pnpm test

# Type checking only
pnpm test:types

# Linting only
pnpm test:lint

# Unit tests only
pnpm test:unit
```

### Project Structure

```
src/
├── main.ts              # Application entry point
├── agent/               # LangGraph agent and tools
├── server/              # Fastify HTTP server and routes
├── database/            # Knex setup and migrations
├── tickets/             # Ticket service
├── git/                 # Git operations (simple-git)
├── cdk8s/               # CDK8s integration
├── validation/          # Pre-commit validators
├── audit/               # Audit logging
├── config/              # Convict configuration
└── services/            # Service container (DI)
```

## Documentation

- [Core Architecture Spec](spec/001-core-architecture.md) - Comprehensive system design
- [TUI Spec](spec/002-tui.md) - Terminal user interface design
- [Coding Standards](docs/coding-standards.md) - TypeScript best practices

## Ticket Lifecycle

```
DRAFT → PLANNING → PENDING_PLAN_APPROVAL → EXECUTING
                                              │
                         ┌────────────────────┼────────────────────┐
                         ▼                    ▼                    ▼
                   PENDING_APPROVAL     PENDING_INPUT         OBSERVING
                         │                    │                    │
                         └────────────────────┴────────────────────┘
                                              │
                         ┌────────────────────┴────────────────────┐
                         ▼                                         ▼
                       PAUSED ──────────────────────────────▶  RESOLVED
                                                               FAILED
                                                               CANCELLED
```

## Agent Tools

The agent has access to these tool categories:

- **Git**: Clone, checkout, commit, push, read/write files
- **Validation**: Schema validation, YAML lint, secret scanning
- **Kubernetes**: kubectl get, describe, logs, events (read-only)
- **ArgoCD**: List apps, sync, wait, rollback
- **Human Interaction**: Request approval, ask questions, notify

## Roadmap

- [x] TUI (Terminal User Interface)
- [ ] Proactive health monitoring
- [ ] Multi-cluster support
- [ ] Advanced notifications (Slack, Discord)
- [ ] Permission scoping and RBAC
- [ ] Automatic rollback on failure

## License

AGPL3

---

_Aura - Your AI reliability engineer that never sleeps._
