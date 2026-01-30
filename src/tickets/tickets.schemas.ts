import { z } from 'zod';

import {
  ticketStatusSchema,
  ticketPrioritySchema,
  tokenUsageSchema,
  pendingApprovalSchema,
  pendingQuestionSchema,
  commitInfoSchema,
  structuredPlanSchema,
} from '#root/database/database.schemas.ts';

const ticketSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  status: ticketStatusSchema,
  priority: ticketPrioritySchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  resolvedAt: z.string().nullable(),
  structuredPlan: structuredPlanSchema.nullable(),
  currentTurn: z.number(),
  maxTurns: z.number(),
  tokenUsage: tokenUsageSchema,
  pendingApproval: pendingApprovalSchema.nullable(),
  pendingQuestion: pendingQuestionSchema.nullable(),
  workingBranch: z.string().nullable(),
  commits: z.array(commitInfoSchema),
});

type Ticket = z.infer<typeof ticketSchema>;

const createTicketInputSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  priority: ticketPrioritySchema.optional(),
  maxTurns: z.number().int().positive().optional(),
});

type CreateTicketInput = z.infer<typeof createTicketInputSchema>;

const updateTicketInputSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  priority: ticketPrioritySchema.optional(),
  maxTurns: z.number().int().positive().optional(),
});

type UpdateTicketInput = z.infer<typeof updateTicketInputSchema>;

const ticketStatusTransitionSchema = z.object({
  from: ticketStatusSchema,
  to: ticketStatusSchema,
});

type TicketStatusTransition = z.infer<typeof ticketStatusTransitionSchema>;

const approveTicketInputSchema = z.object({
  approvedBy: z.string().min(1),
});

type ApproveTicketInput = z.infer<typeof approveTicketInputSchema>;

const answerQuestionInputSchema = z.object({
  answer: z.string().min(1),
});

type AnswerQuestionInput = z.infer<typeof answerQuestionInputSchema>;

export type {
  Ticket,
  CreateTicketInput,
  UpdateTicketInput,
  TicketStatusTransition,
  ApproveTicketInput,
  AnswerQuestionInput,
};

export {
  ticketSchema,
  createTicketInputSchema,
  updateTicketInputSchema,
  ticketStatusTransitionSchema,
  approveTicketInputSchema,
  answerQuestionInputSchema,
};
