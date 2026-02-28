// Database migrations for ABMusic.
// Each migration is idempotent (uses IF NOT EXISTS).
// Add new migrations as the schema evolves.

export const migrations = [
  {
    version: 1,
    description: 'Initial schema',
    // The initial schema is created in schema.ts via CREATE_TABLES_SQL
    sql: '', // No additional migration needed for v1
  },
  {
    version: 2,
    description: 'Add recommendation tables (engagement, affinity, genre cache)',
    sql: `
      CREATE TABLE IF NOT EXISTS track_engagement (
        track_id TEXT PRIMARY KEY,
        play_count INTEGER DEFAULT 0,
        skip_count INTEGER DEFAULT 0,
        total_listen_ms INTEGER DEFAULT 0,
        last_played_at INTEGER,
        last_skipped_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS artist_affinity (
        artist_key TEXT PRIMARY KEY,
        artist_name TEXT NOT NULL,
        score REAL DEFAULT 0,
        play_count INTEGER DEFAULT 0,
        skip_count INTEGER DEFAULT 0,
        updated_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS genre_cache (
        artist_key TEXT PRIMARY KEY,
        genres TEXT NOT NULL,
        fetched_at INTEGER
      );
    `,
  },
  {
    version: 3,
    description: 'Add app_settings table for persistent settings',
    sql: `
      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `,
  },
];
