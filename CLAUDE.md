# CLAUDE.md - AI Assistant Context for Aura

This file provides context and guidelines for AI assistants (like Claude) working on the Aura codebase.

## Project Overview

Aura is an AI-driven Kubernetes cluster management agent. It operates through a ticket-based system where users submit requests (deploy apps, debug issues, configure networking), and Aura autonomously resolves them via GitOps - modifying infrastructure-as-code, pushing to git, and monitoring ArgoCD.

**Core principles:**
- GitOps-First: All cluster changes flow through git, never direct cluster modifications
- Observable: Full audit trail of every action, decision, and reasoning
- Human-in-the-Loop: Escalates when uncertain, requires approval for destructive operations

## Technology Stack

- **Runtime**: Node.js 22+ with `--experimental-strip-types` (native TypeScript, no build step)
- **Agent Framework**: LangGraph for stateful agent workflows
- **API Server**: Fastify with Zod validation
- **Database**: Knex with SQLite (dev) / PostgreSQL (prod)
- **Git**: simple-git for repository operations
- **IaC**: cdk8s for Kubernetes manifest generation

## Project Structure

```
src/
├── main.ts              # Application entry point
├── agent/               # LangGraph agent, tools, and checkpointing
├── server/              # Fastify HTTP server and routes
├── database/            # Knex setup and migrations
├── tickets/             # Ticket service (primary unit of work)
├── git/                 # Git operations (simple-git wrapper)
├── cdk8s/               # CDK8s integration
├── validation/          # Pre-commit validators
├── audit/               # Audit logging
├── config/              # Convict configuration
└── services/            # Service container (DI)

spec/                    # Design specifications
docs/                    # User and developer documentation
config/                  # Configuration files
```

## Coding Standards

**CRITICAL**: Always follow the coding standards in `docs/coding-standards.md`. Key points:

- **Types over interfaces**: Always use `type`, never `interface`
- **Arrow functions**: Always use arrow function syntax
- **Explicit exports**: All exports at end of file using `export type {}` and `export {}`
- **File extensions**: Always include `.ts` in imports
- **Zod schemas**: Name as `{name}Schema`, infer types as `{Name}`
- **Private fields**: Use `#` prefix, never `private` keyword
- **Module structure**: `{module}/{module}.ts` with support files as `{module}/{module}.{area}.ts`
- **No index files**: Never use `index.ts`
- **Testing**: Use Node's native `node:test` runner

## Documentation Responsibility

**IMPORTANT**: You are responsible for keeping documentation accurate and up-to-date.

### Documentation Files

| File | Purpose |
|------|---------|
| `README.md` | Project overview, quick start, basic usage |
| `docs/getting-started.md` | Step-by-step tutorial for new users |
| `docs/api-reference.md` | Complete API endpoint documentation |
| `docs/configuration.md` | Configuration options and environment variables |
| `docs/coding-standards.md` | TypeScript coding standards |
| `spec/001-core-architecture.md` | System architecture specification |
| `spec/002-tui.md` | TUI design specification |

### Documentation Guidelines

1. **Keep docs in sync with code**: When you modify code that affects documented behavior, update the relevant documentation in the same change.

2. **Fix discrepancies immediately**: If you discover documentation that doesn't match the actual code behavior, fix it. Don't leave known inaccuracies.

3. **API changes require doc updates**: Any change to API endpoints, request/response formats, or configuration options must be reflected in `docs/api-reference.md` or `docs/configuration.md`.

4. **New features need documentation**: When implementing new features, add appropriate documentation before considering the work complete.

5. **Spec files are living documents**: Update spec files when implementation diverges from the original design or when design decisions change.

6. **Examples should work**: Code examples in documentation should be tested and functional. If you change an API, verify the examples still work.

### When to Update Documentation

- Adding or removing API endpoints
- Changing request/response schemas
- Adding or modifying configuration options
- Changing environment variables
- Modifying the agent's tool set
- Updating ticket status transitions
- Adding new features or screens to the TUI
- Fixing bugs that were incorrectly documented as features
- Implementing items from the spec (mark as complete)

## Key Concepts

### Tickets

The primary unit of work. A ticket flows through statuses:
```
DRAFT → PLANNING → PENDING_PLAN_APPROVAL → EXECUTING
                                              │
         ┌────────────────────────────────────┼────────────────────────────┐
         ▼                                    ▼                            ▼
   PENDING_APPROVAL                    PENDING_INPUT                   OBSERVING
         │                                    │                            │
         └────────────────────────────────────┴────────────────────────────┘
                                              │
                              ┌───────────────┴───────────────┐
                              ▼                               ▼
                           PAUSED                     RESOLVED / FAILED / CANCELLED
```

### Agent Tools

The agent has access to tools in categories:
- **Git**: Clone, checkout, commit, push, read/write files
- **Validation**: Schema validation, YAML lint, secret scanning
- **Human Interaction**: Request approval, ask questions, notify

### Service Container

Simple dependency injection via `ServiceContainer`. Services are lazy-loaded and resolved in methods, not constructors.

## Running the Project

```bash
# Development
pnpm dev

# Production
pnpm start

# Tests
pnpm test          # All tests
pnpm test:types    # Type checking
pnpm test:lint     # Linting
pnpm test:unit     # Unit tests
```

## Common Tasks

### Adding a New API Endpoint

1. Add route handler in `src/server/routes/`
2. Define Zod schemas for request/response
3. Update `docs/api-reference.md` with the new endpoint
4. Add tests

### Adding a New Agent Tool

1. Create tool in `src/agent/tools/`
2. Register in `src/agent/tools/tools.ts`
3. Update `spec/001-core-architecture.md` tool table
4. Add tests

### Modifying Configuration

1. Update schema in `src/config/config.ts`
2. Update `docs/configuration.md` with new options
3. Update `README.md` if it's a commonly-used option

### Database Migrations

Create migration files in `src/database/migrations/` following the naming pattern `{number}_{description}.ts`.

## Error Handling

- Throw specific error types (defined in `{module}.errors.ts`)
- Let callers decide how to handle errors
- Log at application boundaries, not in library code
- Use `.cause` for error chaining

## Testing Approach

- Test files live next to code: `user.test.ts` alongside `user.ts`
- Use `node:test` with `assert`
- Mock dependencies via the service container
- Focus on behavior, not implementation

## What Not to Do

- Don't use `interface` - use `type`
- Don't use `function` declarations - use arrow functions
- Don't use `private` keyword - use `#` for private fields
- Don't use `any` - use `unknown`
- Don't use `index.ts` files
- Don't scatter exports throughout file
- Don't skip file extensions in imports
- Don't leave documentation out of sync with code
