import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert';

import type { Knex } from 'knex';

import { TicketService } from './tickets.ts';
import { TicketNotFoundError, InvalidStatusTransitionError, NoPlanError } from './tickets.errors.ts';

import type { StructuredPlan } from '#root/database/database.schemas.ts';

const createMockDb = () => {
  const rows = new Map<string, Record<string, unknown>>();
  let lastWhereId: string | null = null;

  const mockQueryBuilder = {
    insert: mock.fn((row: unknown) => {
      const r = row as { id: string };
      rows.set(r.id, row as Record<string, unknown>);
      return Promise.resolve([r.id]);
    }),
    where: mock.fn((_field: string, value: unknown) => {
      lastWhereId = value as string;
      return mockQueryBuilder;
    }),
    first: mock.fn(() => {
      if (!lastWhereId) return Promise.resolve(undefined);
      return Promise.resolve(rows.get(lastWhereId));
    }),
    update: mock.fn((updates: Record<string, unknown>) => {
      if (lastWhereId && rows.has(lastWhereId)) {
        const existing = rows.get(lastWhereId);
        if (existing) {
          rows.set(lastWhereId, { ...existing, ...updates });
        }
      }
      return Promise.resolve(1);
    }),
    delete: mock.fn(() => {
      if (lastWhereId) rows.delete(lastWhereId);
      return Promise.resolve(1);
    }),
    orderBy: mock.fn(() => mockQueryBuilder),
    then: (resolve: (value: unknown[]) => void) => resolve(Array.from(rows.values())),
  };

  const db = mock.fn(() => {
    lastWhereId = null;
    return mockQueryBuilder;
  }) as unknown as Knex;

  return { db, rows, mockQueryBuilder };
};

describe('TicketService', () => {
  let service: TicketService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    service = new TicketService(mockDb.db, 50);
  });

  describe('create', () => {
    it('creates a ticket with default values', async () => {
      const ticket = await service.create({
        title: 'Test Ticket',
        description: 'Test description',
      });

      assert.ok(ticket.id);
      assert.strictEqual(ticket.title, 'Test Ticket');
      assert.strictEqual(ticket.description, 'Test description');
      assert.strictEqual(ticket.status, 'draft');
      assert.strictEqual(ticket.priority, 'medium');
      assert.strictEqual(ticket.currentTurn, 0);
      assert.strictEqual(ticket.maxTurns, 50);
    });

    it('creates a ticket with custom priority', async () => {
      const ticket = await service.create({
        title: 'Test Ticket',
        description: 'Test description',
        priority: 'high',
      });

      assert.strictEqual(ticket.priority, 'high');
    });

    it('creates a ticket with custom maxTurns', async () => {
      const ticket = await service.create({
        title: 'Test Ticket',
        description: 'Test description',
        maxTurns: 100,
      });

      assert.strictEqual(ticket.maxTurns, 100);
    });
  });

  describe('get', () => {
    it('throws TicketNotFoundError when ticket does not exist', async () => {
      await assert.rejects(() => service.get('non-existent'), TicketNotFoundError);
    });
  });

  describe('transitionStatus', () => {
    it('validates status transitions', async () => {
      const ticket = await service.create({
        title: 'Test Ticket',
        description: 'Test description',
      });

      await assert.rejects(() => service.transitionStatus(ticket.id, 'completed'), InvalidStatusTransitionError);
    });
  });

  describe('setStructuredPlan', () => {
    it('sets a structured plan on a ticket', async () => {
      const ticket = await service.create({
        title: 'Test Ticket',
        description: 'Test description',
      });

      const plan: StructuredPlan = {
        version: 1,
        summary: 'Test plan summary',
        steps: [
          {
            id: 'step-1',
            index: 0,
            title: 'Step 1',
            description: 'First step description',
            status: 'pending',
            startedAt: null,
            completedAt: null,
            output: null,
            error: null,
            retryCount: 0,
            maxRetries: 3,
          },
          {
            id: 'step-2',
            index: 1,
            title: 'Step 2',
            description: 'Second step description',
            status: 'pending',
            startedAt: null,
            completedAt: null,
            output: null,
            error: null,
            retryCount: 0,
            maxRetries: 3,
          },
        ],
        generatedAt: new Date().toISOString(),
        approvedAt: null,
        approvedBy: null,
      };

      const updated = await service.setStructuredPlan(ticket.id, plan);

      assert.ok(updated.structuredPlan);
      const updatedPlan = updated.structuredPlan;
      assert.strictEqual(updatedPlan.summary, 'Test plan summary');
      assert.strictEqual(updatedPlan.steps.length, 2);
      const firstStep = updatedPlan.steps[0];
      assert.ok(firstStep);
      assert.strictEqual(firstStep.title, 'Step 1');
    });

    it('throws TicketNotFoundError for non-existent ticket', async () => {
      const plan: StructuredPlan = {
        version: 1,
        summary: 'Test',
        steps: [],
        generatedAt: new Date().toISOString(),
        approvedAt: null,
        approvedBy: null,
      };

      await assert.rejects(() => service.setStructuredPlan('non-existent', plan), TicketNotFoundError);
    });
  });

  describe('updatePlanStep', () => {
    it('updates a step status', async () => {
      const ticket = await service.create({
        title: 'Test Ticket',
        description: 'Test description',
      });

      const plan: StructuredPlan = {
        version: 1,
        summary: 'Test plan',
        steps: [
          {
            id: 'step-1',
            index: 0,
            title: 'Step 1',
            description: 'First step',
            status: 'pending',
            startedAt: null,
            completedAt: null,
            output: null,
            error: null,
            retryCount: 0,
            maxRetries: 3,
          },
        ],
        generatedAt: new Date().toISOString(),
        approvedAt: null,
        approvedBy: null,
      };

      await service.setStructuredPlan(ticket.id, plan);

      const now = new Date().toISOString();
      const updated = await service.updatePlanStep(ticket.id, 0, {
        status: 'in_progress',
        startedAt: now,
      });

      assert.ok(updated.structuredPlan);
      const updatedPlan = updated.structuredPlan;
      const firstStep = updatedPlan.steps[0];
      assert.ok(firstStep);
      assert.strictEqual(firstStep.status, 'in_progress');
      assert.strictEqual(firstStep.startedAt, now);
    });

    it('throws NoPlanError when ticket has no structured plan', async () => {
      const ticket = await service.create({
        title: 'Test Ticket',
        description: 'Test description',
      });

      await assert.rejects(() => service.updatePlanStep(ticket.id, 0, { status: 'in_progress' }), NoPlanError);
    });
  });

  describe('getCurrentStep', () => {
    it('returns null when no structured plan exists', async () => {
      const ticket = await service.create({
        title: 'Test Ticket',
        description: 'Test description',
      });

      const step = await service.getCurrentStep(ticket.id);
      assert.strictEqual(step, null);
    });

    it('returns null when no step is in progress', async () => {
      const ticket = await service.create({
        title: 'Test Ticket',
        description: 'Test description',
      });

      const plan: StructuredPlan = {
        version: 1,
        summary: 'Test plan',
        steps: [
          {
            id: 'step-1',
            index: 0,
            title: 'Step 1',
            description: 'First step',
            status: 'pending',
            startedAt: null,
            completedAt: null,
            output: null,
            error: null,
            retryCount: 0,
            maxRetries: 3,
          },
        ],
        generatedAt: new Date().toISOString(),
        approvedAt: null,
        approvedBy: null,
      };

      await service.setStructuredPlan(ticket.id, plan);

      const step = await service.getCurrentStep(ticket.id);
      assert.strictEqual(step, null);
    });

    it('returns the in-progress step', async () => {
      const ticket = await service.create({
        title: 'Test Ticket',
        description: 'Test description',
      });

      const plan: StructuredPlan = {
        version: 1,
        summary: 'Test plan',
        steps: [
          {
            id: 'step-1',
            index: 0,
            title: 'Step 1',
            description: 'First step',
            status: 'completed',
            startedAt: '2024-01-01T00:00:00Z',
            completedAt: '2024-01-01T00:01:00Z',
            output: 'Done',
            error: null,
            retryCount: 0,
            maxRetries: 3,
          },
          {
            id: 'step-2',
            index: 1,
            title: 'Step 2',
            description: 'Second step',
            status: 'in_progress',
            startedAt: '2024-01-01T00:01:00Z',
            completedAt: null,
            output: null,
            error: null,
            retryCount: 0,
            maxRetries: 3,
          },
        ],
        generatedAt: new Date().toISOString(),
        approvedAt: null,
        approvedBy: null,
      };

      await service.setStructuredPlan(ticket.id, plan);

      const step = await service.getCurrentStep(ticket.id);
      assert.ok(step);
      assert.strictEqual(step.id, 'step-2');
      assert.strictEqual(step.status, 'in_progress');
    });
  });
});
