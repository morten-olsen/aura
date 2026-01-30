import type { Knex } from 'knex';

import type { AuditLogEntry, CreateAuditLogInput, AuditLogQuery } from './audit.schemas.ts';

import type { ServiceContainer } from '#root/services/services.ts';
import type { AuditLogRow } from '#root/database/database.schemas.ts';

const rowToAuditLogEntry = (row: AuditLogRow): AuditLogEntry => ({
  id: row.id,
  ticketId: row.ticket_id,
  timestamp: row.timestamp,
  type: row.type,
  actor: row.actor,
  action: row.action,
  reasoning: row.reasoning,
  toolCall: row.tool_call ? JSON.parse(row.tool_call) : null,
  stateChange: row.state_change ? JSON.parse(row.state_change) : null,
  tokenUsage: row.token_usage ? JSON.parse(row.token_usage) : null,
});

class AuditService {
  #db: Knex;

  constructor(db: Knex) {
    this.#db = db;
  }

  log = async (input: CreateAuditLogInput): Promise<AuditLogEntry> => {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();

    const row: AuditLogRow = {
      id,
      ticket_id: input.ticketId,
      timestamp: now,
      type: input.type,
      actor: input.actor,
      action: input.action,
      reasoning: input.reasoning ?? null,
      tool_call: input.toolCall ? JSON.stringify(input.toolCall) : null,
      state_change: input.stateChange ? JSON.stringify(input.stateChange) : null,
      token_usage: input.tokenUsage ? JSON.stringify(input.tokenUsage) : null,
    };

    await this.#db('audit_logs').insert(row);

    return rowToAuditLogEntry(row);
  };

  query = async (query: AuditLogQuery): Promise<AuditLogEntry[]> => {
    let builder = this.#db<AuditLogRow>('audit_logs').orderBy('timestamp', 'desc');

    if (query.ticketId) {
      builder = builder.where('ticket_id', query.ticketId);
    }

    if (query.type) {
      builder = builder.where('type', query.type);
    }

    if (query.startTime) {
      builder = builder.where('timestamp', '>=', query.startTime);
    }

    if (query.endTime) {
      builder = builder.where('timestamp', '<=', query.endTime);
    }

    if (query.limit) {
      builder = builder.limit(query.limit);
    }

    if (query.offset) {
      builder = builder.offset(query.offset);
    }

    const rows = await builder;
    return rows.map(rowToAuditLogEntry);
  };

  getByTicket = async (ticketId: string): Promise<AuditLogEntry[]> => {
    return this.query({ ticketId });
  };

  get = async (id: string): Promise<AuditLogEntry | null> => {
    const row = await this.#db<AuditLogRow>('audit_logs').where('id', id).first();
    return row ? rowToAuditLogEntry(row) : null;
  };
}

const registerAuditService = (container: ServiceContainer): void => {
  container.register('audit', async (c) => {
    const db = await c.resolve<Knex>('database');
    return new AuditService(db);
  });
};

export { AuditService, registerAuditService };
