import { z } from 'zod';

import { agentPhaseSchema, tokenUsageSchema, structuredPlanSchema } from '#root/database/database.schemas.ts';

const messageRoleSchema = z.enum(['system', 'user', 'assistant', 'tool']);

type MessageRole = z.infer<typeof messageRoleSchema>;

const toolCallSchema = z.object({
  id: z.string(),
  name: z.string(),
  args: z.record(z.string(), z.unknown()),
});

type ToolCall = z.infer<typeof toolCallSchema>;

const messageSchema = z.object({
  role: messageRoleSchema,
  content: z.string(),
  toolCalls: z.array(toolCallSchema).optional(),
  toolCallId: z.string().optional(),
});

type Message = z.infer<typeof messageSchema>;

const agentStateSchema = z.object({
  ticketId: z.string(),
  messages: z.array(messageSchema),
  structuredPlan: structuredPlanSchema.nullable(),
  currentStepIndex: z.number(),
  phase: agentPhaseSchema,
  tokenUsage: tokenUsageSchema,
  waitingFor: z.enum(['approval', 'answer']).nullable(),
  humanInput: z
    .object({
      type: z.enum(['approval', 'answer']),
      approved: z.boolean().optional(),
      answer: z.string().optional(),
    })
    .nullable(),
});

type AgentState = z.infer<typeof agentStateSchema>;

const toolResultSchema = z.object({
  tool: z.string(),
  input: z.record(z.string(), z.unknown()),
  output: z.unknown(),
  success: z.boolean(),
  error: z.string().optional(),
  duration: z.number(),
});

type ToolResult = z.infer<typeof toolResultSchema>;

const agentRunResultSchema = z.object({
  ticketId: z.string(),
  phase: agentPhaseSchema,
  success: z.boolean(),
  error: z.string().optional(),
  waitingFor: z.enum(['approval', 'answer']).nullable(),
});

type AgentRunResult = z.infer<typeof agentRunResultSchema>;

const humanInputSchema = z.object({
  type: z.enum(['approval', 'answer']),
  approved: z.boolean().optional(),
  answer: z.string().optional(),
});

type HumanInput = z.infer<typeof humanInputSchema>;

export type { MessageRole, ToolCall, Message, AgentState, ToolResult, AgentRunResult, HumanInput };

export {
  messageRoleSchema,
  toolCallSchema,
  messageSchema,
  agentStateSchema,
  toolResultSchema,
  agentRunResultSchema,
  humanInputSchema,
};
