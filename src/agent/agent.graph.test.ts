import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert';

import { AIMessage } from '@langchain/core/messages';
import type { DynamicStructuredTool } from '@langchain/core/tools';

import { createAgentGraph, AgentStateAnnotation } from './agent.graph.ts';

// Mock LLM that returns predefined responses
const createMockLlm = (responses: string[]) => {
  let callIndex = 0;

  const invoke = mock.fn(async () => {
    const content = responses[callIndex] ?? 'TASK_COMPLETE';
    callIndex++;

    return new AIMessage({
      content,
      usage_metadata: {
        input_tokens: 100,
        output_tokens: 50,
      },
    });
  });

  const bindTools = mock.fn(() => ({
    invoke: mock.fn(async () => {
      const content = responses[callIndex] ?? 'Step completed successfully. TASK_COMPLETE';
      callIndex++;

      return new AIMessage({
        content,
        tool_calls: [],
        usage_metadata: {
          input_tokens: 100,
          output_tokens: 50,
        },
      });
    }),
  }));

  return {
    invoke,
    bindTools,
    _getCallIndex: () => callIndex,
  };
};

// Mock tools (empty for basic tests)
const createMockTools = (): DynamicStructuredTool[] => [];

// Mock ticket service
const createMockTicketService = () => ({
  setStructuredPlan: mock.fn(() => Promise.resolve()),
  updatePlanStep: mock.fn(() => Promise.resolve()),
});

describe('Agent Graph End-to-End', () => {
  describe('Planning Phase', () => {
    it('creates a structured plan from LLM response', async () => {
      const planResponse = JSON.stringify({
        summary: 'Test plan summary',
        steps: [
          { title: 'Step 1', description: 'Do step 1' },
          { title: 'Step 2', description: 'Do step 2' },
        ],
      });

      const mockLlm = createMockLlm([planResponse]);
      const mockTicketService = createMockTicketService();

      const graph = createAgentGraph(
        mockLlm as never,
        createMockTools(),
        mockTicketService as never,
      ).compile();

      const initialState = {
        ticketId: 'test-ticket',
        ticketTitle: 'Test Ticket',
        ticketDescription: 'Test description',
        planApprovalRequired: false, // Skip approval for this test
      };

      const result = await graph.invoke(initialState);

      assert.ok(result.structuredPlan, 'Should have a structured plan');
      assert.strictEqual(result.structuredPlan.summary, 'Test plan summary');
      assert.strictEqual(result.structuredPlan.steps.length, 2);
      assert.strictEqual(result.structuredPlan.steps[0].title, 'Step 1');
    });

    it('transitions to waiting phase when plan approval is required', async () => {
      const planResponse = JSON.stringify({
        summary: 'Test plan',
        steps: [{ title: 'Step 1', description: 'Do step 1' }],
      });

      const mockLlm = createMockLlm([planResponse]);
      const mockTicketService = createMockTicketService();

      const graph = createAgentGraph(
        mockLlm as never,
        createMockTools(),
        mockTicketService as never,
      ).compile();

      const initialState = {
        ticketId: 'test-ticket',
        ticketTitle: 'Test Ticket',
        ticketDescription: 'Test description',
        planApprovalRequired: true,
      };

      const result = await graph.invoke(initialState);

      assert.strictEqual(result.phase, 'waiting', 'Phase should be waiting');
      assert.strictEqual(result.waitingFor, 'approval', 'Should be waiting for approval');
      assert.ok(result.structuredPlan, 'Should have a structured plan');
      assert.strictEqual(result.structuredPlan.approvedAt, null, 'Plan should not be approved yet');
    });
  });

  describe('Wait Node with Human Input', () => {
    it('transitions to executing when approval is granted', async () => {
      const planResponse = JSON.stringify({
        summary: 'Test plan',
        steps: [{ title: 'Step 1', description: 'Do step 1' }],
      });

      // Second response for execution, third for review
      const mockLlm = createMockLlm([planResponse, 'Step 1 done', 'TASK_COMPLETE']);
      const mockTicketService = createMockTicketService();

      const graph = createAgentGraph(
        mockLlm as never,
        createMockTools(),
        mockTicketService as never,
      ).compile();

      // First run - creates plan and waits for approval
      const initialState = {
        ticketId: 'test-ticket',
        ticketTitle: 'Test Ticket',
        ticketDescription: 'Test description',
        planApprovalRequired: true,
      };

      const waitingResult = await graph.invoke(initialState);
      assert.strictEqual(waitingResult.phase, 'waiting');
      assert.strictEqual(waitingResult.waitingFor, 'approval');

      // Second run - provide approval input
      const approvalState = {
        ...initialState,
        humanInput: { type: 'approval' as const, approved: true },
        structuredPlan: waitingResult.structuredPlan,
        phase: 'waiting' as const,
        waitingFor: 'approval' as const,
        messages: waitingResult.messages,
      };

      const executingResult = await graph.invoke(approvalState);

      // Should have progressed past waiting
      assert.notStrictEqual(executingResult.phase, 'waiting', 'Should not be waiting anymore');
      assert.strictEqual(executingResult.waitingFor, null, 'Should not be waiting for anything');
    });

    it('transitions to completed with error when approval is denied', async () => {
      const planResponse = JSON.stringify({
        summary: 'Test plan',
        steps: [{ title: 'Step 1', description: 'Do step 1' }],
      });

      const mockLlm = createMockLlm([planResponse]);
      const mockTicketService = createMockTicketService();

      const graph = createAgentGraph(
        mockLlm as never,
        createMockTools(),
        mockTicketService as never,
      ).compile();

      // First run - creates plan and waits
      const initialState = {
        ticketId: 'test-ticket',
        ticketTitle: 'Test Ticket',
        ticketDescription: 'Test description',
        planApprovalRequired: true,
      };

      const waitingResult = await graph.invoke(initialState);

      // Deny approval
      const denialState = {
        ...initialState,
        humanInput: { type: 'approval' as const, approved: false },
        structuredPlan: waitingResult.structuredPlan,
        phase: 'waiting' as const,
        waitingFor: 'approval' as const,
        messages: waitingResult.messages,
      };

      const result = await graph.invoke(denialState);

      assert.strictEqual(result.phase, 'completed', 'Should be completed');
      assert.ok(result.error, 'Should have an error');
      assert.ok(result.error.includes('rejected'), 'Error should mention rejection');
    });
  });

  describe('Execution Phase', () => {
    it('executes steps and completes when no approval required', async () => {
      const planResponse = JSON.stringify({
        summary: 'Simple plan',
        steps: [{ title: 'Only Step', description: 'Do the thing' }],
      });

      const mockLlm = createMockLlm([
        planResponse,
        'I completed the step successfully.',
        'TASK_COMPLETE',
      ]);
      const mockTicketService = createMockTicketService();

      const graph = createAgentGraph(
        mockLlm as never,
        createMockTools(),
        mockTicketService as never,
      ).compile();

      const initialState = {
        ticketId: 'test-ticket',
        ticketTitle: 'Test Ticket',
        ticketDescription: 'Test description',
        planApprovalRequired: false,
      };

      const result = await graph.invoke(initialState);

      assert.strictEqual(result.phase, 'completed', 'Should be completed');
      assert.ok(result.structuredPlan, 'Should have plan');

      // Verify updatePlanStep was called
      const updateCalls = mockTicketService.updatePlanStep.mock.calls;
      assert.ok(updateCalls.length >= 1, 'Should have updated plan steps');
    });

    it('increments currentStepIndex after completing a step', async () => {
      const planResponse = JSON.stringify({
        summary: 'Multi-step plan',
        steps: [
          { title: 'Step 1', description: 'First step' },
          { title: 'Step 2', description: 'Second step' },
        ],
      });

      const mockLlm = createMockLlm([
        planResponse,
        'Step 1 done',
        'Step 2 done',
        'TASK_COMPLETE',
      ]);
      const mockTicketService = createMockTicketService();

      const graph = createAgentGraph(
        mockLlm as never,
        createMockTools(),
        mockTicketService as never,
      ).compile();

      const initialState = {
        ticketId: 'test-ticket',
        ticketTitle: 'Test Ticket',
        ticketDescription: 'Test description',
        planApprovalRequired: false,
      };

      const result = await graph.invoke(initialState);

      assert.strictEqual(result.phase, 'completed');
      // currentStepIndex should be past the last step
      assert.ok(result.currentStepIndex >= 2, 'Should have incremented past all steps');
    });
  });

  describe('Full Flow with Checkpointing', () => {
    it('completes full flow: plan -> wait -> approve -> execute -> complete', async () => {
      const planResponse = JSON.stringify({
        summary: 'Complete flow test',
        steps: [{ title: 'Single Step', description: 'Execute this' }],
      });

      const mockLlm = createMockLlm([
        planResponse,        // Planning phase
        'Step executed.',    // Execution phase
        'TASK_COMPLETE',     // Review phase
      ]);
      const mockTicketService = createMockTicketService();

      const graph = createAgentGraph(
        mockLlm as never,
        createMockTools(),
        mockTicketService as never,
      ).compile();

      // Phase 1: Create plan (with approval required)
      const phase1Result = await graph.invoke({
        ticketId: 'test-ticket',
        ticketTitle: 'Test',
        ticketDescription: 'Test',
        planApprovalRequired: true,
      });

      assert.strictEqual(phase1Result.phase, 'waiting', 'Phase 1: Should be waiting');
      assert.strictEqual(phase1Result.waitingFor, 'approval', 'Phase 1: Should wait for approval');
      assert.ok(phase1Result.structuredPlan, 'Phase 1: Should have plan');

      // Phase 2: Provide approval and continue
      const phase2Result = await graph.invoke({
        ticketId: 'test-ticket',
        ticketTitle: 'Test',
        ticketDescription: 'Test',
        planApprovalRequired: true,
        humanInput: { type: 'approval', approved: true },
        structuredPlan: phase1Result.structuredPlan,
        phase: 'waiting',
        waitingFor: 'approval',
        messages: phase1Result.messages,
        currentStepIndex: 0,
      });

      assert.strictEqual(phase2Result.phase, 'completed', 'Phase 2: Should be completed');
      assert.strictEqual(phase2Result.waitingFor, null, 'Phase 2: Should not be waiting');
    });
  });

  describe('Error Handling', () => {
    it('handles invalid JSON in plan response', async () => {
      const mockLlm = createMockLlm(['This is not valid JSON']);
      const mockTicketService = createMockTicketService();

      const graph = createAgentGraph(
        mockLlm as never,
        createMockTools(),
        mockTicketService as never,
      ).compile();

      const result = await graph.invoke({
        ticketId: 'test-ticket',
        ticketTitle: 'Test',
        ticketDescription: 'Test',
        planApprovalRequired: false,
      });

      assert.strictEqual(result.phase, 'completed');
      assert.ok(result.error, 'Should have an error');
      assert.ok(result.error.includes('JSON'), 'Error should mention JSON');
    });
  });
});

describe('Agent Graph State Annotations', () => {
  it('exports AgentStateAnnotation with expected structure', () => {
    // Verify the annotation exists and has the expected shape
    assert.ok(AgentStateAnnotation, 'AgentStateAnnotation should exist');
    assert.ok(AgentStateAnnotation.spec, 'Should have spec');

    // These are the expected state fields
    const expectedFields = [
      'ticketId',
      'ticketTitle',
      'ticketDescription',
      'messages',
      'structuredPlan',
      'currentStepIndex',
      'phase',
      'tokenUsage',
      'waitingFor',
      'humanInput',
      'planApprovalRequired',
      'error',
    ];

    for (const field of expectedFields) {
      assert.ok(field in AgentStateAnnotation.spec, `Should have ${field} in spec`);
    }
  });
});
