import type { RadioStrategy } from '../types';
import type { MusicTrack } from '../../youtube/types';
import { artistRadio } from './artistRadio';
import { discoveryRadio } from './discoveryRadio';

// Mix radio: interleaves artist radio + discovery radio tracks,
// deduplicating by track ID. Seed format: "videoId|||artist|||track"
export const mixRadio: RadioStrategy = {
  name: 'Mix Radio',
  async generateTracks(seed: string): Promise<MusicTrack[]> {
    const [videoId, artist, track] = seed.split('|||');
    if (!videoId) return [];

    // Fetch both in parallel
    const [artistTracks, discoveryTracks] = await Promise.allSettled([
      artistRadio.generateTracks(videoId),
      artist && track
        ? discoveryRadio.generateTracks(`${artist}|||${track}`)
        : Promise.resolve([]),
    ]);

    const aList =
      artistTracks.status === 'fulfilled' ? artistTracks.value : [];
    const dList =
      discoveryTracks.status === 'fulfilled' ? discoveryTracks.value : [];

    // Interleave: 2 artist, 1 discovery
    const result: MusicTrack[] = [];
    const seen = new Set<string>();
    let ai = 0;
    let di = 0;

    while (result.length < 20 && (ai < aList.length || di < dList.length)) {
      // Add 2 from artist
      for (let k = 0; k < 2 && ai < aList.length; ai++) {
        if (!seen.has(aList[ai].id)) {
          seen.add(aList[ai].id);
          result.push(aList[ai]);
          k++;
        }
      }
      // Add 1 from discovery
      while (di < dList.length) {
        if (!seen.has(dList[di].id)) {
          seen.add(dList[di].id);
          result.push(dList[di]);
          di++;
          break;
        }
        di++;
      }
    }

    return result;
  },
};
