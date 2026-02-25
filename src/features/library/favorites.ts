import { getDatabase } from '@/core/database/db';
import type { MusicTrack } from '../youtube/types';

export async function getFavorites(): Promise<MusicTrack[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    track_id: string;
    title: string;
    artist: string;
    artist_id: string | null;
    album: string | null;
    duration: number;
    thumbnail: string | null;
  }>('SELECT * FROM favorites ORDER BY added_at DESC');

  return rows.map((row) => ({
    id: row.track_id,
    title: row.title,
    artist: row.artist,
    artistId: row.artist_id ?? undefined,
    album: row.album ?? undefined,
    duration: row.duration,
    thumbnail: row.thumbnail ?? '',
  }));
}

export async function addFavorite(track: MusicTrack): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT OR REPLACE INTO favorites (track_id, title, artist, artist_id, album, duration, thumbnail)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    track.id,
    track.title,
    track.artist,
    track.artistId ?? null,
    track.album ?? null,
    track.duration,
    track.thumbnail,
  );
}

export async function removeFavorite(trackId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM favorites WHERE track_id = ?', trackId);
}

export async function isFavorite(trackId: string): Promise<boolean> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM favorites WHERE track_id = ?',
    trackId,
  );
  return (row?.count ?? 0) > 0;
}
