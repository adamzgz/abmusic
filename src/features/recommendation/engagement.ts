import { getDatabase } from '@/core/database/db';
import type { MusicTrack } from '@/features/youtube/types';
import type { PlaySession } from './types';

// In-memory map of active play sessions (trackId → session).
// Keeps at most 2 entries to track current + previous track.
const playingSessions = new Map<string, PlaySession>();

// Thresholds for classifying a play as "complete" vs "skip"
const SKIP_MAX_SECONDS = 30;
const SKIP_MAX_RATIO = 0.15;
const COMPLETE_MIN_RATIO = 0.80;
const COMPLETE_MIN_SECONDS = 30;

// Called when a track starts playing.
export function trackPlayStarted(track: MusicTrack) {
  // Evict old sessions if map grows beyond 2
  if (playingSessions.size >= 2) {
    const oldest = playingSessions.keys().next().value;
    if (oldest && oldest !== track.id) {
      playingSessions.delete(oldest);
    }
  }

  playingSessions.set(track.id, {
    trackId: track.id,
    startedAt: Date.now(),
    durationSec: track.duration,
  });

  // Update play_count + last_played_at
  updatePlayCount(track.id).catch(() => {});
}

// Called when a track stops playing (user skipped, track ended, new track started).
// Calculates listen time and classifies engagement.
export async function trackPlayEnded(trackId: string) {
  const session = playingSessions.get(trackId);
  if (!session) return;

  playingSessions.delete(trackId);

  const listenedMs = Date.now() - session.startedAt;
  const listenedSec = listenedMs / 1000;
  const ratio = session.durationSec > 0 ? listenedSec / session.durationSec : 0;

  const isSkip =
    listenedSec < SKIP_MAX_SECONDS && ratio < SKIP_MAX_RATIO;
  const isComplete =
    ratio >= COMPLETE_MIN_RATIO || listenedSec >= COMPLETE_MIN_SECONDS;

  try {
    const db = await getDatabase();

    // Update total listen time
    await db.runAsync(
      `UPDATE track_engagement
       SET total_listen_ms = total_listen_ms + ?
       WHERE track_id = ?`,
      listenedMs,
      trackId
    );

    if (isSkip) {
      await db.runAsync(
        `UPDATE track_engagement
         SET skip_count = skip_count + 1, last_skipped_at = ?
         WHERE track_id = ?`,
        Date.now(),
        trackId
      );
      if (__DEV__) console.log(`[engagement] Skip: ${trackId} (${listenedSec.toFixed(1)}s, ${(ratio * 100).toFixed(0)}%)`);
    } else if (isComplete) {
      if (__DEV__) console.log(`[engagement] Complete: ${trackId} (${listenedSec.toFixed(1)}s, ${(ratio * 100).toFixed(0)}%)`);
    }
  } catch (err) {
    if (__DEV__) console.warn('[engagement] Failed to update:', err);
  }
}

// Increment play_count, upsert the engagement row.
async function updatePlayCount(trackId: string) {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO track_engagement (track_id, play_count, skip_count, total_listen_ms, last_played_at)
     VALUES (?, 1, 0, 0, ?)
     ON CONFLICT(track_id) DO UPDATE SET
       play_count = play_count + 1,
       last_played_at = ?`,
    trackId,
    Date.now(),
    Date.now()
  );
}

// Get engagement data for a specific track (used by scoring).
export async function getTrackEngagement(trackId: string) {
  const db = await getDatabase();
  return db.getFirstAsync<{
    track_id: string;
    play_count: number;
    skip_count: number;
    total_listen_ms: number;
    last_played_at: number | null;
    last_skipped_at: number | null;
  }>('SELECT * FROM track_engagement WHERE track_id = ?', trackId);
}

// Get total play count across all tracks (for cold start detection).
export async function getTotalPlayCount(): Promise<number> {
  const db = await getDatabase();
  const result = await db.getFirstAsync<{ total: number }>(
    'SELECT COALESCE(SUM(play_count), 0) as total FROM track_engagement'
  );
  return result?.total ?? 0;
}
