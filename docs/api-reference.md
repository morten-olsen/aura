# API Reference

Aura exposes a RESTful API with Server-Sent Events (SSE) for real-time updates.

Base URL: `http://localhost:3000/api`

## Authentication

Authentication is not yet implemented. Future versions will support API tokens.

## Tickets

### Create Ticket

Creates a new ticket for the agent to process.

```
POST /api/tickets
```

**Request Body:**

```json
{
  "title": "string (required)",
  "description": "string (required)",
  "priority": "low | medium | high | critical (default: medium)"
}
```

**Response:** `201 Created`

```json
{
  "id": "uuid",
  "title": "Deploy Redis cluster",
  "description": "Deploy a 3-node Redis cluster...",
  "status": "draft",
  "priority": "medium",
  "createdAt": "2024-01-15T14:30:00Z",
  "updatedAt": "2024-01-15T14:30:00Z",
  "currentTurn": 0,
  "maxTurns": 50,
  "tokenUsage": {
    "promptTokens": 0,
    "completionTokens": 0,
    "totalTokens": 0
  }
}
```

### List Tickets

Returns all tickets with optional filtering.

```
GET /api/tickets
```

**Query Parameters:**

| Parameter  | Type   | Description                                    |
| ---------- | ------ | ---------------------------------------------- |
| `status`   | string | Filter by status (comma-separated)             |
| `priority` | string | Filter by priority (comma-separated)           |
| `limit`    | number | Maximum results (default: 50)                  |
| `offset`   | number | Pagination offset                              |

**Response:** `200 OK`

```json
{
  "tickets": [
    {
      "id": "uuid",
      "title": "Deploy Redis cluster",
      "status": "executing",
      "priority": "medium",
      "createdAt": "2024-01-15T14:30:00Z",
      "updatedAt": "2024-01-15T14:35:00Z"
    }
  ],
  "total": 1
}
```

### Get Ticket

Returns full ticket details including plan and pending actions.

```
GET /api/tickets/:id
```

**Response:** `200 OK`

```json
{
  "id": "uuid",
  "title": "Deploy Redis cluster",
  "description": "Deploy a 3-node Redis cluster...",
  "status": "pending_plan_approval",
  "priority": "medium",
  "createdAt": "2024-01-15T14:30:00Z",
  "updatedAt": "2024-01-15T14:35:00Z",
  "plan": {
    "summary": "Create Redis StatefulSet with Sentinel",
    "steps": [
      {
        "description": "Create data namespace",
        "tool": "git_write_file"
      },
      {
        "description": "Generate StatefulSet manifest",
        "tool": "git_write_file"
      }
    ],
    "estimatedTools": ["git_write_file", "git_commit", "git_push", "argo_sync"],
    "risks": ["Data namespace may already exist"]
  },
  "currentTurn": 3,
  "maxTurns": 50,
  "tokenUsage": {
    "promptTokens": 12500,
    "completionTokens": 2300,
    "totalTokens": 14800,
    "estimatedCost": 0.42
  },
  "workingBranch": "aura/ticket-abc123",
  "commits": ["abc123f", "def456g"],
  "pendingApproval": null,
  "pendingQuestion": null
}
```

### Update Ticket

Updates ticket metadata (not status transitions).

```
PATCH /api/tickets/:id
```

**Request Body:**

```json
{
  "title": "string (optional)",
  "description": "string (optional)",
  "priority": "low | medium | high | critical (optional)",
  "maxTurns": "number (optional)"
}
```

**Response:** `200 OK` - Updated ticket

### Cancel Ticket

Cancels a ticket and stops agent processing.

```
POST /api/tickets/:id/cancel
```

**Response:** `200 OK`

```json
{
  "id": "uuid",
  "status": "cancelled"
}
```

## Plan Approval

### Approve Plan

Approves the agent's proposed plan, allowing execution to begin.

```
POST /api/tickets/:id/approve-plan
```

**Request Body:** (optional)

```json
{
  "approvedBy": "string (optional, for audit trail)"
}
```

**Response:** `200 OK`

```json
{
  "id": "uuid",
  "status": "executing",
  "planApprovedAt": "2024-01-15T14:40:00Z"
}
```

## Action Approval

### Approve/Deny Action

Responds to an agent request for approval of a specific action.

```
POST /api/tickets/:id/approve
```

**Request Body:**

```json
{
  "approved": true,
  "reason": "string (optional, useful when denying)"
}
```

**Response:** `200 OK`

```json
{
  "id": "uuid",
  "status": "executing",
  "pendingApproval": null
}
```

## Question Answering

### Answer Question

Provides an answer to a question the agent has asked.

```
POST /api/tickets/:id/answer
```

**Request Body:**

```json
{
  "answer": "string (required)"
}
```

**Response:** `200 OK`

```json
{
  "id": "uuid",
  "status": "executing",
  "pendingQuestion": null
}
```

## Ticket Resumption

### Resume Ticket

Resumes a paused ticket, optionally granting additional turns.

```
POST /api/tickets/:id/resume
```

**Request Body:**

```json
{
  "additionalTurns": 20
}
```

**Response:** `200 OK`

```json
{
  "id": "uuid",
  "status": "executing",
  "maxTurns": 70
}
```

## Agent Execution

### Run Agent

Starts or continues agent processing on a ticket.

```
POST /api/tickets/:id/run
```

**Response:** `202 Accepted`

```json
{
  "message": "Agent started",
  "ticketId": "uuid"
}
```

The agent runs asynchronously. Use SSE streaming to monitor progress.

## Audit Log

### Get Ticket Audit Log

Returns the complete audit history for a ticket.

```
GET /api/tickets/:id/audit
```

**Query Parameters:**

| Parameter | Type   | Description                         |
| --------- | ------ | ----------------------------------- |
| `type`    | string | Filter by event type (comma-sep)    |
| `limit`   | number | Maximum results (default: 100)      |
| `offset`  | number | Pagination offset                   |

**Response:** `200 OK`

```json
{
  "entries": [
    {
      "id": "uuid",
      "ticketId": "uuid",
      "timestamp": "2024-01-15T14:35:42Z",
      "type": "tool_called",
      "actor": "agent",
      "action": "git_commit",
      "reasoning": "Creating commit with Redis manifests",
      "toolCall": {
        "name": "git_commit",
        "args": {
          "message": "Add Redis StatefulSet"
        },
        "result": {
          "sha": "abc123f"
        }
      },
      "tokenUsage": {
        "promptTokens": 450,
        "completionTokens": 120,
        "totalTokens": 570
      }
    }
  ],
  "total": 42
}
```

### Get Global Audit Log

Returns audit entries across all tickets.

```
GET /api/audit
```

**Query Parameters:**

| Parameter  | Type   | Description                         |
| ---------- | ------ | ----------------------------------- |
| `ticketId` | string | Filter by ticket ID                 |
| `type`     | string | Filter by event type (comma-sep)    |
| `actor`    | string | Filter by actor (agent/user/system) |
| `since`    | string | ISO timestamp, entries after        |
| `until`    | string | ISO timestamp, entries before       |
| `limit`    | number | Maximum results (default: 100)      |
| `offset`   | number | Pagination offset                   |

**Response:** `200 OK` - Same format as ticket audit log

## Streaming (SSE)

### Subscribe to Ticket Events

Opens a Server-Sent Events stream for real-time ticket updates.

```
GET /api/tickets/:id/stream
```

**Headers:**

| Header          | Value                        |
| --------------- | ---------------------------- |
| `Accept`        | `text/event-stream`          |
| `Last-Event-ID` | Event ID for resumption      |

**Event Format:**

```
id: evt_abc123
event: status_changed
data: {"type":"status_changed","ticketId":"uuid","timestamp":"2024-01-15T14:35:00Z","payload":{"from":"planning","to":"pending_plan_approval"}}
```

**Event Types:**

| Event                | Description                    |
| -------------------- | ------------------------------ |
| `connected`          | Initial connection established |
| `status_changed`     | Ticket status transition       |
| `turn_started`       | Agent began a new turn         |
| `turn_completed`     | Agent finished a turn          |
| `tool_called`        | Agent invoked a tool           |
| `plan_generated`     | Plan ready for review          |
| `approval_needed`    | Human approval required        |
| `question_asked`     | Agent needs input              |
| `commit_created`     | Git commit made                |
| `push_completed`     | Pushed to remote               |
| `argo_sync_started`  | ArgoCD sync triggered          |
| `argo_health_update` | ArgoCD health changed          |
| `error`              | Error occurred                 |
| `resolved`           | Ticket completed               |
| `heartbeat`          | Keep-alive (every 30s)         |

### Subscribe to All Events

Opens an SSE stream for all ticket events.

```
GET /api/stream
```

**Query Parameters:**

| Parameter  | Type   | Description                    |
| ---------- | ------ | ------------------------------ |
| `status`   | string | Filter by status (comma-sep)   |
| `priority` | string | Filter by priority (comma-sep) |

## Health & Status

### Health Check

Returns server health status.

```
GET /api/health
```

**Response:** `200 OK`

```json
{
  "status": "healthy",
  "version": "1.0.0",
  "uptime": 3600,
  "database": "connected",
  "git": "available",
  "llm": "available"
}
```

### Server Info

Returns server configuration and version info.

```
GET /api/info
```

**Response:** `200 OK`

```json
{
  "version": "1.0.0",
  "environment": "production",
  "llm": {
    "model": "gpt-4-turbo",
    "provider": "openai"
  },
  "features": {
    "planApprovalRequired": true,
    "destructiveActionApproval": true,
    "autoMergeOnResolution": true
  }
}
```

### Statistics

Returns usage statistics.

```
GET /api/stats
```

**Response:** `200 OK`

```json
{
  "tickets": {
    "total": 150,
    "byStatus": {
      "draft": 2,
      "executing": 1,
      "resolved": 140,
      "failed": 5,
      "cancelled": 2
    }
  },
  "tokenUsage": {
    "total": 2500000,
    "estimatedCost": 75.50,
    "last24h": 50000,
    "last7d": 300000
  },
  "agent": {
    "totalTurns": 5000,
    "averageTurnsPerTicket": 33,
    "toolCalls": {
      "git_commit": 500,
      "git_push": 450,
      "kubectl_get": 1200
    }
  }
}
```

## Error Responses

All endpoints return errors in a consistent format:

```json
{
  "error": {
    "code": "TICKET_NOT_FOUND",
    "message": "Ticket with ID abc123 not found",
    "details": {}
  }
}
```

**Common Error Codes:**

| Code                   | HTTP Status | Description                        |
| ---------------------- | ----------- | ---------------------------------- |
| `VALIDATION_ERROR`     | 400         | Invalid request body               |
| `TICKET_NOT_FOUND`     | 404         | Ticket ID doesn't exist            |
| `INVALID_TRANSITION`   | 400         | Status transition not allowed      |
| `APPROVAL_NOT_PENDING` | 400         | No pending approval to respond to  |
| `QUESTION_NOT_PENDING` | 400         | No pending question to answer      |
| `AGENT_BUSY`           | 409         | Agent already processing ticket    |
| `INTERNAL_ERROR`       | 500         | Unexpected server error            |

## Rate Limits

Rate limits are not currently enforced. Future versions may implement:

- 100 requests/minute per IP (API calls)
- 10 concurrent SSE connections per IP
- 50 tickets created per hour

## Webhook Support

Webhook support is planned for future releases. This will allow:

- Ticket status change notifications
- Approval request notifications
- Resolution/failure notifications
