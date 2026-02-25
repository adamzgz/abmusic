import type { RadioStrategy } from '../types';
import type { MusicTrack } from '../../youtube/types';
import { getSimilarTracks } from '../../metadata/lastfm';
import { searchMusic } from '../../youtube/search';

// Discovery radio: uses Last.fm similar tracks API, then resolves each
// on YouTube Music. Seed format: "artist|||track" (pipe-separated).
export const discoveryRadio: RadioStrategy = {
  name: 'Discovery Radio',
  async generateTracks(seed: string): Promise<MusicTrack[]> {
    const [artist, track] = seed.split('|||');
    if (!artist || !track) return [];

    let similar: any[];
    try {
      similar = await getSimilarTracks(artist, track, 15);
    } catch {
      return [];
    }

    // Resolve each similar track on YouTube Music
    const tracks: MusicTrack[] = [];
    for (const s of similar.slice(0, 10)) {
      const name = s.name ?? s.title;
      const art = s.artist?.name ?? artist;
      if (!name) continue;

      try {
        const results = await searchMusic(`${art} ${name}`);
        if (results.tracks.length > 0) {
          tracks.push(results.tracks[0]);
        }
      } catch {
        // Skip failed lookups
      }
    }

    return tracks;
  },
};
