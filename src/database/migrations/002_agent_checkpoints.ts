import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Drop the old agent_states table and recreate with new schema for LangGraph checkpointing
  await knex.schema.dropTableIfExists('agent_states');

  await knex.schema.createTable('agent_states', (table) => {
    table.text('ticket_id').notNullable().references('id').inTable('tickets').onDelete('CASCADE');
    table.text('checkpoint_id').notNullable();
    table.text('parent_checkpoint_id');
    table.text('state').notNullable();
    table.text('metadata');
    table.text('pending_writes');
    table.text('created_at').notNullable();
    table.text('updated_at');

    table.primary(['ticket_id', 'checkpoint_id']);
    table.index('ticket_id', 'idx_agent_states_ticket');
    table.index('created_at', 'idx_agent_states_created');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('agent_states');

  // Restore original schema
  await knex.schema.createTable('agent_states', (table) => {
    table.text('ticket_id').primary().references('id').inTable('tickets');
    table.text('current_phase').notNullable();
    table.text('memory').notNullable();
    table.text('pending_actions').notNullable().defaultTo('[]');
    table.text('last_checkpoint').notNullable();
  });
}
