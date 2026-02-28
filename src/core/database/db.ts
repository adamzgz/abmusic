import * as SQLite from 'expo-sqlite';
import { CREATE_TABLES_SQL } from './schema';
import { migrations } from './migrations';

let db: SQLite.SQLiteDatabase | null = null;
let initPromise: Promise<SQLite.SQLiteDatabase> | null = null;

// Run pending migrations based on user_version pragma.
async function runMigrations(database: SQLite.SQLiteDatabase) {
  const result = await database.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version'
  );
  const currentVersion = result?.user_version ?? 0;

  for (const migration of migrations) {
    if (migration.version > currentVersion && migration.sql) {
      console.log(`[db] Running migration v${migration.version}: ${migration.description}`);
      await database.execAsync(migration.sql);
    }
  }

  const latestVersion = migrations[migrations.length - 1]?.version ?? 0;
  if (latestVersion > currentVersion) {
    await database.execAsync(`PRAGMA user_version = ${latestVersion}`);
  }
}

// Get or initialize the database singleton.
// Uses a Promise lock to prevent concurrent initialization race conditions.
export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const database = await SQLite.openDatabaseAsync('abmusic.db');

    // Enable WAL mode for better concurrent read performance
    await database.execAsync('PRAGMA journal_mode = WAL;');
    await database.execAsync('PRAGMA foreign_keys = ON;');

    // Create tables
    await database.execAsync(CREATE_TABLES_SQL);

    // Run any pending migrations
    await runMigrations(database);

    db = database;
    return database;
  })();

  return initPromise;
}
