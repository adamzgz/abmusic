// Database migrations for SonicFlow.
// Each migration is idempotent (uses IF NOT EXISTS).
// Add new migrations as the schema evolves.

export const migrations = [
  {
    version: 1,
    description: 'Initial schema',
    // The initial schema is created in schema.ts via CREATE_TABLES_SQL
    sql: '', // No additional migration needed for v1
  },
];
