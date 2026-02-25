import { getInnertube } from './client';
import type { MusicTrack, SearchResults } from './types';

// Search for music using YouTube Music's dedicated search endpoint.
// Returns normalized MusicTrack objects.
export async function searchMusic(query: string): Promise<SearchResults> {
  const yt = await getInnertube();
  const results = await yt.music.search(query, { type: 'song' });

  const contents = results.contents ?? [];

  // Log structure in dev to debug
  if (__DEV__ && contents.length > 0) {
    const first = contents[0] as any;
    console.log('[search] first item type:', first?.type, 'keys:', Object.keys(first ?? {}));
  }
  if (__DEV__) {
    console.log('[search] total contents:', contents.length);
  }

  const tracks: MusicTrack[] = contents
    .map((item: any) => {
      // Handle both direct items and nested section shelves
      const entries: any[] = item.contents ?? [item];
      return entries.map((entry: any) => ({
        id: entry.id ?? entry.video_id ?? '',
        title: entry.title ?? entry.name ?? 'Unknown',
        artist:
          entry.artists?.[0]?.name ??
          entry.author?.name ??
          entry.author ??
          'Unknown artist',
        artistId: entry.artists?.[0]?.channel_id,
        album: entry.album?.name,
        albumId: entry.album?.id,
        duration: entry.duration?.seconds ?? 0,
        thumbnail: entry.thumbnails?.[0]?.url ?? entry.thumbnail?.url ?? '',
      }));
    })
    .flat()
    .filter((track: MusicTrack) => track.id !== '');

  return {
    tracks,
    hasMore: typeof results.getContinuation === 'function',
  };
}

// Get search suggestions for autocomplete.
export async function getSearchSuggestions(input: string): Promise<string[]> {
  if (input.length < 2) return [];
  const yt = await getInnertube();
  const suggestions = await yt.music.getSearchSuggestions(input);
  return suggestions
    .map((s: any) => s.text ?? s.query ?? '')
    .filter(Boolean);
}
