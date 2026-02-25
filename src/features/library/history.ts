import { getDatabase } from '@/core/database/db';
import type { MusicTrack } from '../youtube/types';

export interface HistoryEntry {
  track: MusicTrack;
  playedAt: number;
}

export async function getHistory(limit = 50): Promise<HistoryEntry[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    track_id: string;
    title: string;
    artist: string;
    artist_id: string | null;
    album: string | null;
    duration: number;
    thumbnail: string | null;
    played_at: number;
  }>('SELECT * FROM play_history ORDER BY played_at DESC LIMIT ?', limit);

  return rows.map((row) => ({
    track: {
      id: row.track_id,
      title: row.title,
      artist: row.artist,
      artistId: row.artist_id ?? undefined,
      album: row.album ?? undefined,
      duration: row.duration,
      thumbnail: row.thumbnail ?? '',
    },
    playedAt: row.played_at,
  }));
}

export async function addToHistory(track: MusicTrack): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO play_history (track_id, title, artist, artist_id, album, duration, thumbnail, played_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    track.id,
    track.title,
    track.artist,
    track.artistId ?? null,
    track.album ?? null,
    track.duration,
    track.thumbnail,
    Date.now(),
  );
}

export async function clearHistory(): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM play_history');
}
