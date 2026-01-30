import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('tickets', (table) => {
    table.text('id').primary();
    table.text('title').notNullable();
    table.text('description').notNullable();
    table.text('status').notNullable().defaultTo('draft');
    table.text('priority').notNullable().defaultTo('medium');
    table.text('created_at').notNullable();
    table.text('updated_at').notNullable();
    table.text('resolved_at');
    table.text('plan');
    table.text('plan_approved_at');
    table.text('plan_approved_by');
    table.integer('current_turn').notNullable().defaultTo(0);
    table.integer('max_turns').notNullable().defaultTo(50);
    table.text('token_usage').notNullable().defaultTo('{}');
    table.text('pending_approval');
    table.text('pending_question');
    table.text('working_branch');
    table.text('commits').notNullable().defaultTo('[]');

    table.index('status', 'idx_tickets_status');
  });

  await knex.schema.createTable('audit_logs', (table) => {
    table.text('id').primary();
    table.text('ticket_id').notNullable().references('id').inTable('tickets');
    table.text('timestamp').notNullable();
    table.text('type').notNullable();
    table.text('actor').notNullable();
    table.text('action').notNullable();
    table.text('reasoning');
    table.text('tool_call');
    table.text('state_change');
    table.text('token_usage');

    table.index('ticket_id', 'idx_audit_logs_ticket');
    table.index('timestamp', 'idx_audit_logs_timestamp');
  });

  await knex.schema.createTable('agent_states', (table) => {
    table.text('ticket_id').primary().references('id').inTable('tickets');
    table.text('current_phase').notNullable();
    table.text('memory').notNullable();
    table.text('pending_actions').notNullable().defaultTo('[]');
    table.text('last_checkpoint').notNullable();
  });

  await knex.schema.createTable('knowledge_entries', (table) => {
    table.text('id').primary();
    table.text('path').notNullable();
    table.text('type').notNullable();
    table.text('title').notNullable();
    table.text('summary');
    table.text('last_updated').notNullable();
    table.text('updated_by_ticket').references('id').inTable('tickets');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('knowledge_entries');
  await knex.schema.dropTableIfExists('agent_states');
  await knex.schema.dropTableIfExists('audit_logs');
  await knex.schema.dropTableIfExists('tickets');
}
