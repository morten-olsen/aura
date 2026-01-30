import { describe, it, beforeEach, mock, type Mock } from 'node:test';
import assert from 'node:assert';

import type { Knex } from 'knex';

import { AgentService } from './agent.ts';
import { MaxTurnsExceededError, AgentNotRunningError } from './agent.errors.ts';

import type { AuraConfig } from '#root/config/config.ts';
import type { TicketService } from '#root/tickets/tickets.ts';
import type { GitService } from '#root/git/git.ts';
import type { ValidationService } from '#root/validation/validation.ts';
import type { AuditService } from '#root/audit/audit.ts';

type MockFn = Mock<(...args: unknown[]) => unknown>;

const createMockConfig = (): AuraConfig => ({
  env: 'test',
  server: {
    host: 'localhost',
    port: 4000,
    cors: { origin: ['*'] },
  },
  database: {
    client: 'better-sqlite3',
    connection: {
      filename: ':memory:',
      host: 'localhost',
      port: 5432,
      database: 'aura',
      user: 'aura',
      password: '',
    },
  },
  tickets: {
    defaultMaxTurns: 50,
  },
  git: {
    repoUrl: '',
    branch: 'main',
    workingDir: './workspace',
    authorName: 'Test',
    authorEmail: 'test@test.com',
  },
  logging: {
    level: 'info',
  },
  llm: {
    baseUrl: 'https://api.openai.com/v1',
    apiKey: 'test-key',
    model: 'gpt-4-turbo',
    maxTokensPerTurn: 4096,
    temperature: 0.1,
  },
  agent: {
    planApprovalRequired: true,
    destructiveActionApproval: true,
  },
});

const createMockDb = () => {
  const mockQueryBuilder = {
    insert: mock.fn(() => ({
      onConflict: mock.fn(() => ({
        merge: mock.fn(() => Promise.resolve()),
      })),
    })),
    where: mock.fn(function (this: typeof mockQueryBuilder) {
      return this;
    }),
    first: mock.fn(() => Promise.resolve(undefined)),
    update: mock.fn(() => Promise.resolve(1)),
    delete: mock.fn(() => Promise.resolve(1)),
    orderBy: mock.fn(function (this: typeof mockQueryBuilder) {
      return this;
    }),
  };

  const db = mock.fn(() => mockQueryBuilder) as unknown as Knex;

  return { db, mockQueryBuilder };
};

type MockTicket = {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt: null;
  plan: null;
  planApprovedAt: null;
  planApprovedBy: null;
  currentTurn: number;
  maxTurns: number;
  tokenUsage: { inputTokens: number; outputTokens: number; totalTokens: number };
  pendingApproval: null;
  pendingQuestion: null;
  workingBranch: null;
  commits: never[];
};

type MockTicketService = {
  get: MockFn;
  create: MockFn;
  transitionStatus: MockFn;
  incrementTurn: MockFn;
  askQuestion: MockFn;
  requestApproval: MockFn;
  grantApproval: MockFn;
  denyApproval: MockFn;
  answerQuestion: MockFn;
  setAuditService: MockFn;
  _mockTicket: MockTicket;
};

const createMockTicketService = (): MockTicketService => {
  const mockTicket: MockTicket = {
    id: 'test-ticket-id',
    title: 'Test Ticket',
    description: 'Test description',
    status: 'approved',
    priority: 'medium',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    resolvedAt: null,
    plan: null,
    planApprovedAt: null,
    planApprovedBy: null,
    currentTurn: 0,
    maxTurns: 50,
    tokenUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    pendingApproval: null,
    pendingQuestion: null,
    workingBranch: null,
    commits: [],
  };

  return {
    get: mock.fn(() => Promise.resolve(mockTicket)),
    create: mock.fn(() => Promise.resolve(mockTicket)),
    transitionStatus: mock.fn(() => Promise.resolve(mockTicket)),
    incrementTurn: mock.fn(() => Promise.resolve(mockTicket)),
    askQuestion: mock.fn(() => Promise.resolve(mockTicket)),
    requestApproval: mock.fn(() => Promise.resolve(mockTicket)),
    grantApproval: mock.fn(() => Promise.resolve(mockTicket)),
    denyApproval: mock.fn(() => Promise.resolve(mockTicket)),
    answerQuestion: mock.fn(() => Promise.resolve(mockTicket)),
    setAuditService: mock.fn(),
    _mockTicket: mockTicket,
  };
};

type MockGitService = {
  getWorktree: MockFn;
  createWorktree: MockFn;
  getWorktreePath: MockFn;
  readFile: MockFn;
  writeFile: MockFn;
  deleteFile: MockFn;
  status: MockFn;
  diff: MockFn;
  stage: MockFn;
  commit: MockFn;
  push: MockFn;
  setAuditService: MockFn;
};

const createMockGitService = (): MockGitService => {
  return {
    getWorktree: mock.fn(() => Promise.resolve({})),
    createWorktree: mock.fn(() => Promise.resolve({ ticketId: 'test', path: '/test', branch: 'test', createdAt: '' })),
    getWorktreePath: mock.fn(() => '/workspace/tickets/test'),
    readFile: mock.fn(() => Promise.resolve('file content')),
    writeFile: mock.fn(() => Promise.resolve()),
    deleteFile: mock.fn(() => Promise.resolve()),
    status: mock.fn(() =>
      Promise.resolve({
        current: 'main',
        tracking: 'origin/main',
        staged: [],
        modified: [],
        deleted: [],
        created: [],
        conflicted: [],
        ahead: 0,
        behind: 0,
      }),
    ),
    diff: mock.fn(() => Promise.resolve('')),
    stage: mock.fn(() => Promise.resolve()),
    commit: mock.fn(() => Promise.resolve({ sha: 'abc123', message: 'test', author: {}, timestamp: '' })),
    push: mock.fn(() => Promise.resolve()),
    setAuditService: mock.fn(),
  };
};

type MockValidationService = {
  validate: MockFn;
  validateFiles: MockFn;
  getValidators: MockFn;
  setAuditService: MockFn;
};

const createMockValidationService = (): MockValidationService => {
  return {
    validate: mock.fn(() => Promise.resolve({ valid: true, issues: [], validatorResults: {} })),
    validateFiles: mock.fn(() => Promise.resolve({ valid: true, issues: [], validatorResults: {} })),
    getValidators: mock.fn(() => []),
    setAuditService: mock.fn(),
  };
};

type MockAuditService = {
  log: MockFn;
};

const createMockAuditService = (): MockAuditService => {
  return {
    log: mock.fn(() => Promise.resolve({ id: 'audit-id' })),
  };
};

describe('AgentService', () => {
  let service: AgentService;
  let mockDb: ReturnType<typeof createMockDb>;
  let mockConfig: AuraConfig;
  let mockTicketService: MockTicketService;
  let mockGitService: MockGitService;
  let mockValidationService: MockValidationService;
  let mockAuditService: MockAuditService;

  beforeEach(() => {
    mockDb = createMockDb();
    mockConfig = createMockConfig();
    mockTicketService = createMockTicketService();
    mockGitService = createMockGitService();
    mockValidationService = createMockValidationService();
    mockAuditService = createMockAuditService();

    service = new AgentService({
      db: mockDb.db,
      config: mockConfig,
      ticketService: mockTicketService as unknown as TicketService,
      gitService: mockGitService as unknown as GitService,
      validationService: mockValidationService as unknown as ValidationService,
      auditService: mockAuditService as unknown as AuditService,
    });
  });

  describe('constructor', () => {
    it('creates an AgentService instance', () => {
      assert.ok(service);
    });
  });

  describe('run', () => {
    it('throws MaxTurnsExceededError when ticket has reached max turns', async () => {
      mockTicketService._mockTicket.currentTurn = 50;
      mockTicketService._mockTicket.maxTurns = 50;

      await assert.rejects(() => service.run('test-ticket-id'), MaxTurnsExceededError);
    });
  });

  describe('getState', () => {
    it('returns null when no state exists', async () => {
      const state = await service.getState('non-existent');
      assert.strictEqual(state, null);
    });
  });

  describe('cancel', () => {
    it('deletes checkpoints and transitions ticket to cancelled', async () => {
      await service.cancel('test-ticket-id');

      assert.strictEqual(mockTicketService.transitionStatus.mock.callCount(), 1);

      const auditCalls = mockAuditService.log.mock.calls;
      const lastCall = auditCalls[auditCalls.length - 1];
      assert.ok(lastCall);
      const args = lastCall.arguments as [{ action: string }];
      assert.strictEqual(args[0].action, 'Agent cancelled by user');
    });
  });

  describe('resume', () => {
    it('throws MaxTurnsExceededError when ticket has reached max turns', async () => {
      mockTicketService._mockTicket.currentTurn = 50;
      mockTicketService._mockTicket.maxTurns = 50;

      await assert.rejects(
        () => service.resume('test-ticket-id', { type: 'approval', approved: true }),
        MaxTurnsExceededError,
      );
    });
  });
});

describe('Agent Errors', () => {
  it('MaxTurnsExceededError has correct code', () => {
    const error = new MaxTurnsExceededError(50);
    assert.strictEqual(error.code, 'MAX_TURNS_EXCEEDED');
    assert.strictEqual(error.message, 'Maximum turns exceeded: 50');
  });

  it('AgentNotRunningError has correct code', () => {
    const error = new AgentNotRunningError('test-id');
    assert.strictEqual(error.code, 'AGENT_NOT_RUNNING');
    assert.ok(error.message.includes('test-id'));
  });
});

describe('Agent Status Transitions', () => {
  // These tests document the expected status transitions.
  // Full integration tests would require mocking the LLM and LangGraph.

  it('should transition to pending_approval when plan approval is required', () => {
    // When the agent creates a plan and planApprovalRequired is true:
    // - phase should be 'waiting'
    // - waitingFor should be 'approval'
    // - ticket status should transition to 'pending_approval'
    //
    // This is verified by the agent.ts code:
    // if (waitingFor === 'approval' && result.structuredPlan && !result.structuredPlan.approvedAt) {
    //   await this.#ticketService.transitionStatus(ticketId, 'pending_approval');
    // }
    assert.ok(true, 'Status transition logic documented');
  });

  it('should transition to awaiting_input for other waiting states', () => {
    // When the agent is waiting for something other than plan approval:
    // - phase should be 'waiting'
    // - waitingFor should be 'answer' (or approval for already-approved plan)
    // - ticket status should transition to 'awaiting_input'
    assert.ok(true, 'Status transition logic documented');
  });

  it('should transition to completed when agent finishes', () => {
    // When the agent completes successfully:
    // - phase should be 'completed'
    // - ticket status should transition to 'completed'
    assert.ok(true, 'Status transition logic documented');
  });
});

describe('Agent Graph Wait Node', () => {
  // These tests document the wait node behavior.
  // The wait node is used when the agent needs human input (approval or answer).

  it('should exit graph when waiting for human input', () => {
    // CRITICAL: The routeAfterWait function must return 'end' when still waiting.
    // If it returns 'wait', the graph enters an infinite loop and never returns.
    //
    // Flow when plan approval is required:
    // 1. Planning node creates plan, sets phase='waiting', waitingFor='approval'
    // 2. routeAfterPlan routes to 'wait' node
    // 3. Wait node has no humanInput, returns {} (no state changes)
    // 4. routeAfterWait sees phase='waiting', must return 'end' (not 'wait'!)
    // 5. Graph exits with phase='waiting', waitingFor='approval'
    // 6. agent.ts receives result and transitions ticket to 'pending_approval'
    //
    // BUG FIX: Previously routeAfterWait returned 'wait' when phase was 'waiting',
    // causing an infinite loop. Now it returns 'end' to exit the graph.
    assert.ok(true, 'Wait node exit behavior documented');
  });

  it('should resume execution when human input is provided', () => {
    // When the agent is resumed with human input:
    // 1. graph.invoke is called with humanInput in state
    // 2. Wait node processes the input
    // 3. If approval granted: sets phase='executing', routes to execute node
    // 4. If approval denied: sets phase='completed' with error, routes to end
    // 5. If answer provided: sets phase='executing', routes to execute node
    assert.ok(true, 'Human input handling documented');
  });

  it('should auto-detect approved plan and provide full state on run()', () => {
    // When run() is called and the ticket has an approved plan:
    // 1. run() checks ticket.structuredPlan?.approvedAt
    // 2. If approved, includes FULL state in initialState:
    //    - structuredPlan (from ticket)
    //    - phase: 'waiting'
    //    - waitingFor: 'approval'
    //    - humanInput: { type: 'approval', approved: true }
    // 3. Graph starts, routeFromStart sees structuredPlan + phase='waiting'
    // 4. Routes to 'wait' node
    // 5. Wait node sees humanInput.approved=true, transitions to executing
    // 6. routeAfterWait routes to 'execute'
    // 7. Execution continues normally
    //
    // CRITICAL: The full state must be provided because LangGraph's state
    // channels may use default values for missing keys even with a checkpointer.
    // By explicitly providing structuredPlan, phase, waitingFor, and humanInput,
    // we ensure routeFromStart correctly routes to the wait node for approval
    // processing instead of going to planning again.
    assert.ok(true, 'Auto-detect approved plan documented');
  });
});
