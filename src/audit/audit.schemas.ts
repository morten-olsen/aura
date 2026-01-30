import { z } from 'zod';

import {
  auditEventTypeSchema,
  actorSchema,
  toolCallInfoSchema,
  stateChangeSchema,
  tokenUsageSchema,
} from '#root/database/database.schemas.ts';

const auditLogEntrySchema = z.object({
  id: z.string(),
  ticketId: z.string(),
  timestamp: z.string(),
  type: auditEventTypeSchema,
  actor: actorSchema,
  action: z.string(),
  reasoning: z.string().nullable(),
  toolCall: toolCallInfoSchema.nullable(),
  stateChange: stateChangeSchema.nullable(),
  tokenUsage: tokenUsageSchema.nullable(),
});

type AuditLogEntry = z.infer<typeof auditLogEntrySchema>;

const createAuditLogInputSchema = z.object({
  ticketId: z.string(),
  type: auditEventTypeSchema,
  actor: actorSchema,
  action: z.string(),
  reasoning: z.string().optional(),
  toolCall: toolCallInfoSchema.optional(),
  stateChange: stateChangeSchema.optional(),
  tokenUsage: tokenUsageSchema.optional(),
});

type CreateAuditLogInput = z.infer<typeof createAuditLogInputSchema>;

const auditLogQuerySchema = z.object({
  ticketId: z.string().optional(),
  type: auditEventTypeSchema.optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  limit: z.number().int().positive().optional(),
  offset: z.number().int().nonnegative().optional(),
});

type AuditLogQuery = z.infer<typeof auditLogQuerySchema>;

export type { AuditLogEntry, CreateAuditLogInput, AuditLogQuery };

export { auditLogEntrySchema, createAuditLogInputSchema, auditLogQuerySchema };
