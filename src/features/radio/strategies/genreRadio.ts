import type { RadioStrategy } from '../types';
import type { MusicTrack } from '../../youtube/types';
import { searchMusic } from '../../youtube/search';

// Genre radio: searches YouTube Music for "${genre} mix" and extracts tracks.
// The seed is the genre name (e.g., "rock", "lo-fi", "hip hop").
export const genreRadio: RadioStrategy = {
  name: 'Genre Radio',
  async generateTracks(genre: string): Promise<MusicTrack[]> {
    const queries = [`${genre} mix`, `${genre} playlist`, `best ${genre} songs`];
    const query = queries[Math.floor(Math.random() * queries.length)];

    const results = await searchMusic(query);
    // Shuffle to add variety on repeated calls
    return shuffleArray(results.tracks).slice(0, 20);
  },
};

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
