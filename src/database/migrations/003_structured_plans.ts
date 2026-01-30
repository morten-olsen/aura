import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('tickets', (table) => {
    table.text('structured_plan'); // JSON string
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('tickets', (table) => {
    table.dropColumn('structured_plan');
  });
}
