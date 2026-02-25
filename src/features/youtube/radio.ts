import { getInnertube } from './client';
import type { MusicTrack } from './types';

// Get the "Up Next" / radio queue for a given video.
// YouTube Music generates an automatic mix based on the seed track.
export async function getRadioTracks(videoId: string): Promise<MusicTrack[]> {
  const yt = await getInnertube();
  const info = await yt.music.getInfo(videoId);
  const upNext = await info.getUpNext(true); // automix = true

  if (!upNext?.contents) return [];

  return upNext.contents
    .map((item: any) => ({
      id: item.video_id ?? item.id ?? '',
      title: item.title ?? 'Unknown',
      artist: item.artists?.[0]?.name ?? item.author ?? 'Unknown artist',
      artistId: item.artists?.[0]?.channel_id,
      duration: item.duration?.seconds ?? 0,
      thumbnail: item.thumbnails?.[0]?.url ?? '',
    }))
    .filter((track: MusicTrack) => track.id !== '' && track.id !== videoId);
}
