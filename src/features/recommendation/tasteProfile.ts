import { getDatabase } from '@/core/database/db';
import type { ArtistAffinityData } from './types';

// How many tracks played before we recompute the profile.
const RECOMPUTE_INTERVAL = 5;
let playsSinceLastCompute = 0;

// Recency multipliers based on when the artist was last played.
const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;
const ONE_MONTH = 30 * 24 * 60 * 60 * 1000;
const THREE_MONTHS = 90 * 24 * 60 * 60 * 1000;

function recencyMultiplier(lastPlayedAt: number | null): number {
  if (!lastPlayedAt) return 0.5;
  const age = Date.now() - lastPlayedAt;
  if (age < ONE_WEEK) return 2.0;
  if (age < ONE_MONTH) return 1.5;
  if (age < THREE_MONTHS) return 1.0;
  return 0.5;
}

// Trigger recomputation after N plays, or on demand.
export function notifyTrackPlayed() {
  playsSinceLastCompute++;
  if (playsSinceLastCompute >= RECOMPUTE_INTERVAL) {
    playsSinceLastCompute = 0;
    recomputeArtistAffinity().catch(() => {});
  }
}

// Normalize artist name for consistent keying.
export function normalizeArtistKey(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

// Recompute artist_affinity from raw engagement + favorites + playlists.
export async function recomputeArtistAffinity(): Promise<void> {
  if (__DEV__) console.log('[tasteProfile] Recomputing artist affinity...');
  const db = await getDatabase();
  const now = Date.now();

  // Aggregate engagement per artist from play_history + track_engagement
  const artistStats = await db.getAllAsync<{
    artist: string;
    artist_id: string | null;
    play_count: number;
    skip_count: number;
    total_listen_ms: number;
    last_played_at: number | null;
    avg_completion: number;
  }>(`
    SELECT
      h.artist,
      h.artist_id,
      COALESCE(SUM(e.play_count), 0) as play_count,
      COALESCE(SUM(e.skip_count), 0) as skip_count,
      COALESCE(SUM(e.total_listen_ms), 0) as total_listen_ms,
      MAX(e.last_played_at) as last_played_at,
      CASE WHEN SUM(e.play_count) > 0
        THEN CAST(SUM(CASE WHEN e.total_listen_ms > 0 AND h.duration > 0
          THEN MIN(1.0, CAST(e.total_listen_ms AS REAL) / (h.duration * 1000 * e.play_count))
          ELSE 0.5 END) AS REAL) / COUNT(DISTINCT h.track_id)
        ELSE 0.5
      END as avg_completion
    FROM (SELECT DISTINCT track_id, artist, artist_id, duration FROM play_history) h
    LEFT JOIN track_engagement e ON e.track_id = h.track_id
    GROUP BY LOWER(TRIM(h.artist))
  `);

  // Count favorites per artist
  const favCounts = await db.getAllAsync<{ artist: string; cnt: number }>(`
    SELECT artist, COUNT(*) as cnt FROM favorites GROUP BY LOWER(TRIM(artist))
  `);
  const favMap = new Map(favCounts.map((r) => [normalizeArtistKey(r.artist), r.cnt]));

  // Count playlist tracks per artist
  const plCounts = await db.getAllAsync<{ artist: string; cnt: number }>(`
    SELECT artist, COUNT(*) as cnt FROM playlist_tracks GROUP BY LOWER(TRIM(artist))
  `);
  const plMap = new Map(plCounts.map((r) => [normalizeArtistKey(r.artist), r.cnt]));

  // Calculate scores and upsert
  for (const row of artistStats) {
    const key = normalizeArtistKey(row.artist);
    const favs = favMap.get(key) ?? 0;
    const plTracks = plMap.get(key) ?? 0;
    const recency = recencyMultiplier(row.last_played_at);

    const score =
      (1.0 * row.play_count +
        5.0 * favs +
        3.0 * plTracks -
        2.0 * row.skip_count +
        1.5 * row.play_count * row.avg_completion) *
      recency;

    await db.runAsync(
      `INSERT INTO artist_affinity (artist_key, artist_name, score, play_count, skip_count, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(artist_key) DO UPDATE SET
         artist_name = ?, score = ?, play_count = ?, skip_count = ?, updated_at = ?`,
      key,
      row.artist,
      score,
      row.play_count,
      row.skip_count,
      now,
      row.artist,
      score,
      row.play_count,
      row.skip_count,
      now
    );
  }

  if (__DEV__) console.log(`[tasteProfile] Updated ${artistStats.length} artist scores`);
}

// Get affinity score for a specific artist.
export async function getArtistScore(artistName: string): Promise<number> {
  const db = await getDatabase();
  const key = normalizeArtistKey(artistName);
  const row = await db.getFirstAsync<{ score: number }>(
    'SELECT score FROM artist_affinity WHERE artist_key = ?',
    key
  );
  return row?.score ?? 0;
}

// Get top N artists by affinity score.
export async function getTopArtists(limit = 20): Promise<ArtistAffinityData[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    artist_key: string;
    artist_name: string;
    score: number;
    play_count: number;
    skip_count: number;
    updated_at: number;
  }>('SELECT * FROM artist_affinity ORDER BY score DESC LIMIT ?', limit);

  return rows.map((r) => ({
    artistKey: r.artist_key,
    artistName: r.artist_name,
    score: r.score,
    playCount: r.play_count,
    skipCount: r.skip_count,
    updatedAt: r.updated_at,
  }));
}
