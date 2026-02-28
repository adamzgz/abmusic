// SQLite schema for ABMusic.
// Uses expo-sqlite for local persistence of playlists, favorites, and history.

export const CREATE_TABLES_SQL = `
  CREATE TABLE IF NOT EXISTS playlists (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
  );

  CREATE TABLE IF NOT EXISTS playlist_tracks (
    playlist_id TEXT NOT NULL,
    track_id TEXT NOT NULL,
    title TEXT NOT NULL,
    artist TEXT NOT NULL,
    artist_id TEXT,
    album TEXT,
    duration INTEGER NOT NULL DEFAULT 0,
    thumbnail TEXT,
    position INTEGER NOT NULL DEFAULT 0,
    added_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
    PRIMARY KEY (playlist_id, track_id),
    FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS favorites (
    track_id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    artist TEXT NOT NULL,
    artist_id TEXT,
    album TEXT,
    duration INTEGER NOT NULL DEFAULT 0,
    thumbnail TEXT,
    added_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
  );

  CREATE TABLE IF NOT EXISTS play_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    track_id TEXT NOT NULL,
    title TEXT NOT NULL,
    artist TEXT NOT NULL,
    artist_id TEXT,
    album TEXT,
    duration INTEGER NOT NULL DEFAULT 0,
    thumbnail TEXT,
    played_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
  );

  CREATE INDEX IF NOT EXISTS idx_history_played_at ON play_history(played_at DESC);
  CREATE INDEX IF NOT EXISTS idx_playlist_tracks_position ON playlist_tracks(playlist_id, position);

  CREATE TABLE IF NOT EXISTS cached_streams (
    video_id TEXT PRIMARY KEY,
    url TEXT NOT NULL,
    itag INTEGER NOT NULL,
    mime_type TEXT NOT NULL,
    bitrate INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS cached_audio (
    track_id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    artist TEXT NOT NULL,
    artist_id TEXT,
    album TEXT,
    duration INTEGER NOT NULL DEFAULT 0,
    thumbnail TEXT,
    file_path TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type TEXT NOT NULL,
    bitrate INTEGER NOT NULL,
    downloaded_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
  );

  CREATE INDEX IF NOT EXISTS idx_cached_audio_downloaded ON cached_audio(downloaded_at DESC);

  CREATE TABLE IF NOT EXISTS player_queue (
    position INTEGER PRIMARY KEY,
    track_id TEXT NOT NULL,
    title TEXT NOT NULL,
    artist TEXT NOT NULL,
    artist_id TEXT,
    album TEXT,
    duration INTEGER NOT NULL DEFAULT 0,
    thumbnail TEXT
  );

  CREATE TABLE IF NOT EXISTS player_state (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

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
`;
