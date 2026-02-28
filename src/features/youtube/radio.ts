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
    .map((item: any) => {
      // YouTube sometimes returns title/artist as objects like {text, runs, rtl}
      const rawTitle = item.title;
      const title = typeof rawTitle === 'string' ? rawTitle
        : rawTitle?.text ?? rawTitle?.toString?.() ?? 'Unknown';
      const rawArtist = item.artists?.[0]?.name ?? item.author;
      const artist = typeof rawArtist === 'string' ? rawArtist
        : rawArtist?.text ?? rawArtist?.toString?.() ?? 'Unknown artist';

      return {
        id: item.video_id ?? item.id ?? '',
        title,
        artist,
        artistId: item.artists?.[0]?.channel_id,
        duration: item.duration?.seconds ?? 0,
        thumbnail: item.thumbnails?.[0]?.url ?? '',
      };
    })
    .filter((track: MusicTrack) => track.id !== '' && track.id !== videoId);
}
