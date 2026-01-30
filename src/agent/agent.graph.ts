import { StateGraph, START, END, Annotation } from '@langchain/langgraph';
import { ChatOpenAI } from '@langchain/openai';
import type { DynamicStructuredTool } from '@langchain/core/tools';
import { AIMessage, HumanMessage, SystemMessage, ToolMessage } from '@langchain/core/messages';
import type { BaseMessage } from '@langchain/core/messages';

import type { HumanInput } from './agent.schemas.ts';

import type { AgentPhase, TokenUsage, StructuredPlan, PlanStep } from '#root/database/database.schemas.ts';
import type { TicketService } from '#root/tickets/tickets.ts';

const SYSTEM_PROMPT = `You are Aura, an autonomous AI agent that helps with software engineering tasks.

You work on tickets that describe changes to be made to a codebase. Your job is to:
1. Understand the ticket requirements
2. Create a plan to implement the changes
3. Execute the plan using the available tools
4. Verify your changes work correctly

Available tools allow you to:
- Read, write, and delete files in the git worktree
- Check git status and create commits
- Run validation checks on files
- Ask questions or request approval from the user

Guidelines:
- Always read files before modifying them to understand the existing code
- Make small, incremental changes and verify each step
- Write clear commit messages explaining what changed
- Request approval for destructive operations
- Ask clarifying questions if requirements are unclear

When creating a plan, break it down into clear, actionable steps.
When executing, work through steps one at a time, verifying each before moving on.`;

// LangGraph state annotation
const AgentStateAnnotation = Annotation.Root({
  ticketId: Annotation<string>,
  ticketTitle: Annotation<string>,
  ticketDescription: Annotation<string>,
  messages: Annotation<BaseMessage[]>({
    reducer: (existing, update) => [...existing, ...update],
    default: () => [],
  }),
  structuredPlan: Annotation<StructuredPlan | null>({
    reducer: (_, update) => update,
    default: () => null,
  }),
  currentStepIndex: Annotation<number>({
    reducer: (_, update) => update,
    default: () => 0,
  }),
  phase: Annotation<AgentPhase>({
    reducer: (_, update) => update,
    default: () => 'planning' as AgentPhase,
  }),
  tokenUsage: Annotation<TokenUsage>({
    reducer: (existing, update) => ({
      inputTokens: existing.inputTokens + update.inputTokens,
      outputTokens: existing.outputTokens + update.outputTokens,
      totalTokens: existing.totalTokens + update.totalTokens,
    }),
    default: () => ({ inputTokens: 0, outputTokens: 0, totalTokens: 0 }),
  }),
  waitingFor: Annotation<'approval' | 'answer' | null>({
    reducer: (_, update) => update,
    default: () => null,
  }),
  humanInput: Annotation<HumanInput | null>({
    reducer: (_, update) => update,
    default: () => null,
  }),
  planApprovalRequired: Annotation<boolean>({
    reducer: (_, update) => update,
    default: () => true,
  }),
  error: Annotation<string | null>({
    reducer: (_, update) => update,
    default: () => null,
  }),
});

type GraphState = typeof AgentStateAnnotation.State;

const extractTokenUsage = (response: AIMessage): TokenUsage => {
  const usage = response.usage_metadata;
  if (!usage) {
    return { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
  }
  return {
    inputTokens: usage.input_tokens ?? 0,
    outputTokens: usage.output_tokens ?? 0,
    totalTokens: (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0),
  };
};

const createPlanNode = (llm: ChatOpenAI, ticketService?: TicketService) => {
  return async (state: GraphState): Promise<Partial<GraphState>> => {
    const planPrompt = `You are working on ticket: "${state.ticketTitle}"

Description:
${state.ticketDescription}

Create a detailed plan to accomplish this task. You MUST respond with valid JSON in this exact format:
{
  "summary": "Brief summary of the approach",
  "steps": [
    {
      "title": "Short title for step 1",
      "description": "Detailed description of what this step accomplishes"
    },
    {
      "title": "Short title for step 2",
      "description": "Detailed description of what this step accomplishes"
    }
  ]
}

Requirements:
- Each step should be specific and actionable
- Steps should be in logical order
- Provide 3-10 steps depending on task complexity
- Respond ONLY with the JSON, no other text`;

    const messages = [new SystemMessage(SYSTEM_PROMPT), new HumanMessage(planPrompt)];

    const response = await llm.invoke(messages);
    const tokenUsage = extractTokenUsage(response);

    const planContent = typeof response.content === 'string' ? response.content : '';

    // Parse the JSON response to create structured plan
    const jsonMatch = planContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        messages: [new HumanMessage(planPrompt), response],
        error: 'Failed to parse plan: No valid JSON found in response',
        phase: 'completed' as AgentPhase,
        tokenUsage,
      };
    }

    const parsed = JSON.parse(jsonMatch[0]) as { summary: string; steps: { title: string; description: string }[] };
    const now = new Date().toISOString();

    const steps: PlanStep[] = parsed.steps.map((step, index) => ({
      id: crypto.randomUUID(),
      index,
      title: step.title,
      description: step.description,
      status: 'pending' as const,
      startedAt: null,
      completedAt: null,
      output: null,
      error: null,
      retryCount: 0,
      maxRetries: 3,
    }));

    const structuredPlan: StructuredPlan = {
      version: 1,
      summary: parsed.summary,
      steps,
      generatedAt: now,
      approvedAt: null,
      approvedBy: null,
    };

    // Save to database
    if (ticketService) {
      await ticketService.setStructuredPlan(state.ticketId, structuredPlan);
    }

    return {
      messages: [new HumanMessage(planPrompt), response],
      structuredPlan,
      currentStepIndex: 0,
      phase: state.planApprovalRequired ? ('waiting' as AgentPhase) : ('executing' as AgentPhase),
      waitingFor: state.planApprovalRequired ? 'approval' : null,
      tokenUsage,
    };
  };
};

const createExecuteNode = (llm: ChatOpenAI, tools: DynamicStructuredTool[], ticketService?: TicketService) => {
  const llmWithTools = llm.bindTools(tools);

  return async (state: GraphState): Promise<Partial<GraphState>> => {
    if (!state.structuredPlan) {
      return {
        error: 'No structured plan available',
        phase: 'completed' as AgentPhase,
      };
    }

    const currentStep = state.structuredPlan.steps[state.currentStepIndex];
    if (!currentStep) {
      return {
        error: `Invalid step index: ${state.currentStepIndex}`,
        phase: 'completed' as AgentPhase,
      };
    }

    const completedSteps = state.structuredPlan.steps
      .filter((s) => s.status === 'completed')
      .map((s) => `${s.index + 1}. ${s.title}: ${s.output ?? 'Done'}`)
      .join('\n');

    const planSummary = state.structuredPlan.steps.map((s) => `${s.index + 1}. ${s.title}`).join('\n');

    const executePrompt = `Continue executing the plan. You are on Step ${state.currentStepIndex + 1} of ${state.structuredPlan.steps.length}.

Current step: ${currentStep.title}
${currentStep.description}

Full plan:
${planSummary}

${completedSteps ? `Completed steps:\n${completedSteps}` : ''}

Execute the current step using the available tools. After completing the step, briefly describe what you did.`;

    const newMessages: BaseMessage[] = [];

    // Add execution prompt if this is a fresh execution
    const lastMessage = state.messages[state.messages.length - 1];
    const lastContent = lastMessage?.content?.toString() ?? '';
    if (state.messages.length === 0 || !lastContent.includes('Continue executing')) {
      newMessages.push(new HumanMessage(executePrompt));
    }

    // Mark step as in_progress
    if (ticketService && currentStep.status === 'pending') {
      await ticketService.updatePlanStep(state.ticketId, state.currentStepIndex, {
        status: 'in_progress',
        startedAt: new Date().toISOString(),
      });
    }

    const allMessages = [new SystemMessage(SYSTEM_PROMPT), ...state.messages, ...newMessages];

    const response = await llmWithTools.invoke(allMessages);
    const tokenUsage = extractTokenUsage(response);

    newMessages.push(response);

    // Handle tool calls
    if (response.tool_calls && response.tool_calls.length > 0) {
      for (const toolCall of response.tool_calls) {
        const tool = tools.find((t) => t.name === toolCall.name);
        if (tool) {
          try {
            const result = await tool.invoke(toolCall.args);
            newMessages.push(
              new ToolMessage({
                content: typeof result === 'string' ? result : JSON.stringify(result),
                tool_call_id: toolCall.id ?? '',
              }),
            );
          } catch (error) {
            newMessages.push(
              new ToolMessage({
                content: `Error: ${(error as Error).message}`,
                tool_call_id: toolCall.id ?? '',
              }),
            );
          }
        }
      }

      // Still executing, need to continue processing tool results
      return {
        messages: newMessages,
        tokenUsage,
        phase: 'executing' as AgentPhase,
      };
    }

    // No tool calls, step is complete
    const stepOutput = typeof response.content === 'string' ? response.content : 'Step completed';

    // Mark step as completed
    if (ticketService) {
      await ticketService.updatePlanStep(state.ticketId, state.currentStepIndex, {
        status: 'completed',
        completedAt: new Date().toISOString(),
        output: stepOutput,
      });
    }

    return {
      messages: newMessages,
      currentStepIndex: state.currentStepIndex + 1,
      tokenUsage,
      phase: 'reviewing' as AgentPhase,
    };
  };
};

const createReviewNode = (llm: ChatOpenAI) => {
  return async (state: GraphState): Promise<Partial<GraphState>> => {
    if (!state.structuredPlan) {
      return {
        error: 'No structured plan available for review',
        phase: 'completed' as AgentPhase,
      };
    }

    const totalSteps = state.structuredPlan.steps.length;

    // Check if we've completed all steps
    if (state.currentStepIndex >= totalSteps) {
      const completedSteps = state.structuredPlan.steps
        .map((s) => `${s.index + 1}. ${s.title}: ${s.output ?? 'Done'}`)
        .join('\n');

      const reviewPrompt = `All steps have been completed. Review the work done:

Plan Summary: ${state.structuredPlan.summary}

Completed steps:
${completedSteps}

Verify that the task has been completed successfully. If everything looks good, respond with "TASK_COMPLETE".
If there are issues or more work needed, explain what needs to be done.`;

      const messages = [new SystemMessage(SYSTEM_PROMPT), ...state.messages, new HumanMessage(reviewPrompt)];

      const response = await llm.invoke(messages);
      const tokenUsage = extractTokenUsage(response);

      const content = typeof response.content === 'string' ? response.content : '';

      if (content.includes('TASK_COMPLETE')) {
        return {
          messages: [new HumanMessage(reviewPrompt), response],
          phase: 'completed' as AgentPhase,
          tokenUsage,
        };
      }

      // Need to continue working
      return {
        messages: [new HumanMessage(reviewPrompt), response],
        phase: 'executing' as AgentPhase,
        tokenUsage,
      };
    }

    // More steps to execute
    return {
      phase: 'executing' as AgentPhase,
    };
  };
};

const createWaitNode = () => {
  return async (state: GraphState): Promise<Partial<GraphState>> => {
    // Check if we have human input to process
    if (state.humanInput) {
      if (state.humanInput.type === 'approval') {
        if (state.humanInput.approved) {
          return {
            phase: 'executing' as AgentPhase,
            waitingFor: null,
            humanInput: null,
            messages: [new HumanMessage('Plan approved. Proceeding with execution.')],
          };
        } else {
          return {
            phase: 'completed' as AgentPhase,
            waitingFor: null,
            humanInput: null,
            error: 'Plan was rejected by user',
          };
        }
      } else if (state.humanInput.type === 'answer') {
        return {
          phase: 'executing' as AgentPhase,
          waitingFor: null,
          humanInput: null,
          messages: [new HumanMessage(`User response: ${state.humanInput.answer}`)],
        };
      }
    }

    // Still waiting
    return {};
  };
};

// Conditional edge functions
const routeAfterPlan = (state: GraphState): string => {
  if (state.phase === 'completed') {
    return 'end';
  }
  if (state.phase === 'waiting') {
    return 'wait';
  }
  return 'execute';
};

const routeAfterExecute = (state: GraphState): string => {
  if (state.phase === 'waiting') {
    return 'wait';
  }
  if (state.phase === 'reviewing') {
    return 'review';
  }
  // Still executing (processing tool calls)
  return 'execute';
};

const routeAfterReview = (state: GraphState): string => {
  if (state.phase === 'completed') {
    return 'end';
  }
  if (state.phase === 'planning') {
    return 'planning';
  }
  return 'execute';
};

const routeAfterWait = (state: GraphState): string => {
  if (state.phase === 'completed') {
    return 'end';
  }
  if (state.phase === 'executing') {
    return 'execute';
  }
  // Still waiting - exit graph to allow resume with input later
  return 'end';
};

// Route from START - determines whether to plan or resume
const routeFromStart = (state: GraphState): string => {
  // If we have a plan, we're resuming - go to appropriate node
  if (state.structuredPlan) {
    // If waiting for human input (approval or answer), go to wait node
    if (state.phase === 'waiting' || state.waitingFor) {
      return 'wait';
    }
    // If executing or reviewing, continue execution
    if (state.phase === 'executing' || state.phase === 'reviewing') {
      return 'execute';
    }
  }
  // No plan yet, or completed - start planning
  return 'planning';
};

type GraphFactoryOptions = {
  llm: ChatOpenAI;
  tools: DynamicStructuredTool[];
  ticketService?: TicketService;
};

// Graph factory
const createAgentGraph = (llm: ChatOpenAI, tools: DynamicStructuredTool[], ticketService?: TicketService) => {
  const planningNode = createPlanNode(llm, ticketService);
  const executeNode = createExecuteNode(llm, tools, ticketService);
  const reviewNode = createReviewNode(llm);
  const waitNode = createWaitNode();

  const graph = new StateGraph(AgentStateAnnotation)
    .addNode('planning', planningNode)
    .addNode('execute', executeNode)
    .addNode('review', reviewNode)
    .addNode('wait', waitNode)
    .addConditionalEdges(START, routeFromStart, { planning: 'planning', wait: 'wait', execute: 'execute' })
    .addConditionalEdges('planning', routeAfterPlan, { end: END, wait: 'wait', execute: 'execute' })
    .addConditionalEdges('execute', routeAfterExecute, { wait: 'wait', review: 'review', execute: 'execute' })
    .addConditionalEdges('review', routeAfterReview, { end: END, planning: 'planning', execute: 'execute' })
    .addConditionalEdges('wait', routeAfterWait, { end: END, execute: 'execute' });

  return graph;
};

export type { GraphState, GraphFactoryOptions };
export { createAgentGraph, AgentStateAnnotation, SYSTEM_PROMPT };
