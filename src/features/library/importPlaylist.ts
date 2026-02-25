import { getInnertube } from '@/features/youtube/client';
import { createPlaylist, addTrackToPlaylist } from './playlists';
import type { MusicTrack } from '@/features/youtube/types';

export type ImportProgress = {
  current: number;
  total: number;
  status: 'fetching' | 'importing' | 'done' | 'error';
  message: string;
};

type ProgressCallback = (progress: ImportProgress) => void;

// Extract YouTube playlist ID from various URL formats
function extractPlaylistId(url: string): string | null {
  const patterns = [
    /[?&]list=([a-zA-Z0-9_-]+)/,
    /playlist\/([a-zA-Z0-9_-]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export async function importYouTubePlaylist(
  url: string,
  onProgress?: ProgressCallback
): Promise<{ playlistId: string; trackCount: number }> {
  const listId = extractPlaylistId(url);
  if (!listId) {
    throw new Error('Invalid YouTube playlist URL');
  }

  onProgress?.({
    current: 0,
    total: 0,
    status: 'fetching',
    message: 'Fetching playlist info...',
  });

  const yt = await getInnertube();
  const playlist = await yt.music.getPlaylist(listId);

  if (!playlist?.contents) {
    throw new Error('Playlist not found or empty');
  }

  const tracks: MusicTrack[] = playlist.contents
    .map((item: any) => ({
      id: item.video_id ?? item.id ?? '',
      title: item.title ?? 'Unknown',
      artist: item.artists?.[0]?.name ?? item.author ?? 'Unknown artist',
      artistId: item.artists?.[0]?.channel_id,
      album: item.album?.name,
      duration: item.duration?.seconds ?? 0,
      thumbnail: item.thumbnails?.[0]?.url ?? '',
    }))
    .filter((t: MusicTrack) => t.id !== '');

  const playlistName =
    (playlist as any).header?.title ?? `Imported Playlist (${tracks.length} songs)`;

  onProgress?.({
    current: 0,
    total: tracks.length,
    status: 'importing',
    message: `Creating playlist "${playlistName}"...`,
  });

  const localPlaylist = await createPlaylist(playlistName);
  const localPlaylistId = localPlaylist.id;

  for (let i = 0; i < tracks.length; i++) {
    await addTrackToPlaylist(localPlaylistId, tracks[i]);
    onProgress?.({
      current: i + 1,
      total: tracks.length,
      status: 'importing',
      message: `Added ${i + 1}/${tracks.length} tracks`,
    });
  }

  onProgress?.({
    current: tracks.length,
    total: tracks.length,
    status: 'done',
    message: `Imported ${tracks.length} tracks`,
  });

  return { playlistId: localPlaylistId, trackCount: tracks.length };
}
