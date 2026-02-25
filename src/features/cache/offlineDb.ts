import { getDatabase } from '@/core/database/db';
import type { MusicTrack } from '@/features/youtube/types';

export interface CachedAudio {
  trackId: string;
  title: string;
  artist: string;
  artistId?: string;
  album?: string;
  duration: number;
  thumbnail?: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  bitrate: number;
  downloadedAt: number;
}

export async function saveCachedAudio(
  track: MusicTrack,
  filePath: string,
  fileSize: number,
  mimeType: string,
  bitrate: number
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT OR REPLACE INTO cached_audio
     (track_id, title, artist, artist_id, album, duration, thumbnail, file_path, file_size, mime_type, bitrate, downloaded_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    track.id,
    track.title,
    track.artist,
    track.artistId ?? null,
    track.album ?? null,
    track.duration,
    track.thumbnail ?? null,
    filePath,
    fileSize,
    mimeType,
    bitrate,
    Date.now()
  );
}

export async function getCachedAudio(trackId: string): Promise<CachedAudio | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<any>(
    'SELECT * FROM cached_audio WHERE track_id = ?',
    trackId
  );
  if (!row) return null;

  return {
    trackId: row.track_id,
    title: row.title,
    artist: row.artist,
    artistId: row.artist_id,
    album: row.album,
    duration: row.duration,
    thumbnail: row.thumbnail,
    filePath: row.file_path,
    fileSize: row.file_size,
    mimeType: row.mime_type,
    bitrate: row.bitrate,
    downloadedAt: row.downloaded_at,
  };
}

export async function removeCachedAudio(trackId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM cached_audio WHERE track_id = ?', trackId);
}

export async function getAllCachedAudio(): Promise<CachedAudio[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM cached_audio ORDER BY downloaded_at DESC'
  );
  return rows.map((row) => ({
    trackId: row.track_id,
    title: row.title,
    artist: row.artist,
    artistId: row.artist_id,
    album: row.album,
    duration: row.duration,
    thumbnail: row.thumbnail,
    filePath: row.file_path,
    fileSize: row.file_size,
    mimeType: row.mime_type,
    bitrate: row.bitrate,
    downloadedAt: row.downloaded_at,
  }));
}

export async function getCacheSize(): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<any>(
    'SELECT COALESCE(SUM(file_size), 0) as total FROM cached_audio'
  );
  return row?.total ?? 0;
}

export function cachedToTrack(cached: CachedAudio): MusicTrack {
  return {
    id: cached.trackId,
    title: cached.title,
    artist: cached.artist,
    artistId: cached.artistId,
    album: cached.album,
    duration: cached.duration,
    thumbnail: cached.thumbnail ?? '',
  };
}
