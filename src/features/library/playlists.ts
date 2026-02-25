import { getDatabase } from '@/core/database/db';
import type { MusicTrack } from '../youtube/types';

export interface Playlist {
  id: string;
  name: string;
  trackCount: number;
  createdAt: number;
  updatedAt: number;
}

export async function getPlaylists(): Promise<Playlist[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    id: string;
    name: string;
    created_at: number;
    updated_at: number;
    track_count: number;
  }>(`
    SELECT p.*, COUNT(pt.track_id) as track_count
    FROM playlists p
    LEFT JOIN playlist_tracks pt ON p.id = pt.playlist_id
    GROUP BY p.id
    ORDER BY p.updated_at DESC
  `);

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    trackCount: row.track_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function createPlaylist(name: string): Promise<Playlist> {
  const db = await getDatabase();
  const now = Date.now();
  const id = `pl_${now}`;
  await db.runAsync(
    'INSERT INTO playlists (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)',
    id,
    name,
    now,
    now,
  );
  return { id, name, trackCount: 0, createdAt: now, updatedAt: now };
}

export async function getPlaylistTracks(playlistId: string): Promise<MusicTrack[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    track_id: string;
    title: string;
    artist: string;
    artist_id: string | null;
    album: string | null;
    duration: number;
    thumbnail: string | null;
  }>(
    'SELECT * FROM playlist_tracks WHERE playlist_id = ? ORDER BY position ASC',
    playlistId,
  );

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

export async function addTrackToPlaylist(
  playlistId: string,
  track: MusicTrack,
): Promise<void> {
  const db = await getDatabase();

  // Get next position
  const row = await db.getFirstAsync<{ max_pos: number | null }>(
    'SELECT MAX(position) as max_pos FROM playlist_tracks WHERE playlist_id = ?',
    playlistId,
  );
  const nextPos = (row?.max_pos ?? -1) + 1;

  await db.runAsync(
    `INSERT OR IGNORE INTO playlist_tracks (playlist_id, track_id, title, artist, artist_id, album, duration, thumbnail, position)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    playlistId,
    track.id,
    track.title,
    track.artist,
    track.artistId ?? null,
    track.album ?? null,
    track.duration,
    track.thumbnail,
    nextPos,
  );

  await db.runAsync(
    'UPDATE playlists SET updated_at = ? WHERE id = ?',
    Date.now(),
    playlistId,
  );
}

export async function removeTrackFromPlaylist(
  playlistId: string,
  trackId: string,
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?',
    playlistId,
    trackId,
  );
  await db.runAsync(
    'UPDATE playlists SET updated_at = ? WHERE id = ?',
    Date.now(),
    playlistId,
  );
}

export async function deletePlaylist(playlistId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM playlists WHERE id = ?', playlistId);
}
