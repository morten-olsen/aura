# Getting Started with Aura

This guide walks you through setting up Aura and creating your first ticket.

## Prerequisites

Before you begin, ensure you have:

- **Node.js 22.6.0+** - Aura uses native TypeScript execution
- **pnpm** - Package manager
- **A Kubernetes cluster** - With ArgoCD installed
- **An infrastructure repository** - Using cdk8s for manifest generation
- **An OpenAI-compatible API key** - For the LLM agent

## Installation

### 1. Clone and Install

```bash
git clone https://github.com/your-org/aura.git
cd aura
pnpm install
```

### 2. Configure

Create a local configuration file:

```bash
cp config/example.json config/local.json
```

Edit `config/local.json`:

```json
{
  "llm": {
    "baseUrl": "https://api.openai.com/v1",
    "model": "gpt-4-turbo",
    "temperature": 0.1
  },
  "git": {
    "repoUrl": "git@github.com:your-org/infrastructure.git",
    "branch": "main",
    "authorName": "Aura Agent",
    "authorEmail": "aura@your-domain.com"
  },
  "argocd": {
    "server": "argocd.your-cluster.local",
    "appName": "infrastructure"
  },
  "agent": {
    "planApprovalRequired": true,
    "destructiveActionApproval": true
  }
}
```

### 3. Set Environment Variables

```bash
# Required: LLM API key
export AURA_LLM_API_KEY="sk-your-api-key"

# Optional: Override config values
export AURA_SERVER_PORT=3000
export AURA_DB_CLIENT=sqlite3
```

### 4. Initialize Database

The database is automatically initialized on first run. For SQLite (default), a file is created at `./data/aura.db`.

### 5. Start the Server

```bash
# Development mode (with file watching)
pnpm dev

# Production mode
pnpm start
```

You should see:

```
[info] Database migrations complete
[info] Aura server listening on http://0.0.0.0:3000
```

## Your First Ticket

### 1. Create a Ticket

Using curl:

```bash
curl -X POST http://localhost:3000/api/tickets \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Deploy nginx hello world",
    "description": "Deploy a simple nginx container serving a hello world page in the default namespace",
    "priority": "medium"
  }'
```

Response:

```json
{
  "id": "abc123-...",
  "title": "Deploy nginx hello world",
  "status": "draft",
  "priority": "medium",
  "createdAt": "2024-01-15T14:30:00Z"
}
```

### 2. Start the Agent

Trigger the agent to plan the work:

```bash
curl -X POST http://localhost:3000/api/tickets/abc123/run
```

The ticket status changes to `planning`. The agent will:
1. Read the infrastructure repo
2. Understand the cdk8s structure
3. Formulate a plan

### 3. Watch Progress (SSE)

Open a new terminal to watch real-time updates:

```bash
curl -N http://localhost:3000/api/tickets/abc123/stream
```

You'll see events like:

```
data: {"type":"status_changed","payload":{"from":"draft","to":"planning"}}
data: {"type":"plan_generated","payload":{"plan":{...}}}
data: {"type":"status_changed","payload":{"from":"planning","to":"pending_plan_approval"}}
```

### 4. Review and Approve the Plan

Get the ticket to see the proposed plan:

```bash
curl http://localhost:3000/api/tickets/abc123
```

Review the plan, then approve:

```bash
curl -X POST http://localhost:3000/api/tickets/abc123/approve-plan
```

### 5. Monitor Execution

The agent now executes the plan. Watch for events:

```
data: {"type":"tool_called","payload":{"tool":"git_write_file","args":{...}}}
data: {"type":"commit_created","payload":{"sha":"abc123f","message":"Add nginx deployment"}}
data: {"type":"push_executed","payload":{"branch":"aura/ticket-abc123"}}
data: {"type":"argo_sync_started","payload":{"app":"infrastructure"}}
data: {"type":"argo_health_update","payload":{"health":"Healthy"}}
data: {"type":"resolved","payload":{"summary":"Successfully deployed nginx"}}
```

### 6. Handle Approvals

If the agent needs approval for a destructive action:

```bash
# The ticket status becomes "pending_approval"
# Get the pending approval details
curl http://localhost:3000/api/tickets/abc123

# Approve or deny
curl -X POST http://localhost:3000/api/tickets/abc123/approve \
  -H "Content-Type: application/json" \
  -d '{"approved": true}'
```

### 7. Answer Questions

If the agent needs clarification:

```bash
# The ticket status becomes "pending_input"
# Get the question
curl http://localhost:3000/api/tickets/abc123

# Provide an answer
curl -X POST http://localhost:3000/api/tickets/abc123/answer \
  -H "Content-Type: application/json" \
  -d '{"answer": "Use 2 replicas for high availability"}'
```

## Common Operations

### List All Tickets

```bash
curl http://localhost:3000/api/tickets
```

With filters:

```bash
curl "http://localhost:3000/api/tickets?status=executing&priority=high"
```

### Cancel a Ticket

```bash
curl -X POST http://localhost:3000/api/tickets/abc123/cancel
```

### Resume a Paused Ticket

If a ticket hits its max turns limit:

```bash
curl -X POST http://localhost:3000/api/tickets/abc123/resume \
  -H "Content-Type: application/json" \
  -d '{"additionalTurns": 20}'
```

### View Audit Log

```bash
curl http://localhost:3000/api/tickets/abc123/audit
```

## Infrastructure Repository Setup

Aura expects your infrastructure repository to use cdk8s. A minimal structure:

```
infrastructure/
├── AGENTS.md              # Agent knowledge file (auto-maintained)
├── cdk8s.yaml             # cdk8s configuration
├── package.json
├── src/
│   ├── main.ts           # Entry point
│   └── constructs/       # cdk8s constructs
├── dist/                 # Generated YAML (gitignored)
└── docs/                 # Documentation (auto-maintained)
```

### AGENTS.md

Create an `AGENTS.md` file at the repo root. This is loaded into the agent's context:

```markdown
# Cluster: homelab

## Overview

Single-node k3s cluster running home services.

## Quick Reference

- ArgoCD UI: https://argocd.homelab.local
- Main namespace: default
- Ingress: nginx-ingress

## Conventions

- Namespace naming: {app}-{env}
- All secrets use SealedSecrets
- Labels required: app, team

## Known Issues

- Cert-manager occasionally needs manual sync after cert rotation
```

The agent will update this file as it learns about your cluster.

## Troubleshooting

### Agent not responding

Check the server logs for errors. Common issues:

- Invalid LLM API key
- Git SSH key not configured
- Cluster not reachable

### Git push failing

Ensure SSH keys are configured:

```bash
# Test SSH access
ssh -T git@github.com

# Or configure git credential helper for HTTPS
```

### ArgoCD sync issues

Verify ArgoCD connectivity:

```bash
# Check ArgoCD config
curl http://localhost:3000/api/health

# Verify ArgoCD token (if using)
argocd app list
```

### Database errors

Reset the database (development only):

```bash
rm data/aura.db
pnpm dev  # Migrations run automatically
```

## Using the TUI

For an interactive experience, use the Terminal User Interface instead of curl commands.

### Client Mode (Connect to Server)

If you have the Aura server running:

```bash
node --experimental-strip-types src/tui/tui.ts
```

### Standalone Mode (All-in-One)

Run the TUI with an embedded server (no separate server process needed):

```bash
# With your config directory
node --experimental-strip-types src/tui/tui.ts --standalone --config ./config
```

### TUI Workflow

1. **Create a ticket**: Press `n` on the dashboard
2. **View ticket**: Navigate with `↑/↓` and press `Enter`
3. **Start the agent**: Press `s` to begin planning
4. **Approve plan**: Press `p` when the plan is ready for review
5. **Monitor progress**: Watch the execution plan steps update in real-time
6. **Handle approvals**: Press `y` to grant or `n` to deny approval requests

The TUI provides real-time updates via SSE (client mode) or polling (standalone mode), so you can watch the agent work without refreshing.

## Next Steps

- Read the [API Reference](api-reference.md) for all endpoints
- Check the [Configuration Guide](configuration.md) for advanced settings
- Review the [Architecture Spec](../spec/001-core-architecture.md) for system design
- See [TUI Spec](../spec/002-tui.md) for keyboard shortcuts and features

## Support

For issues and feature requests, visit the GitHub repository.
