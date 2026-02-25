import type { RadioStrategy } from '../types';
import type { MusicTrack } from '../../youtube/types';
import { getRadioTracks } from '../../youtube/radio';

// Artist radio: uses YouTube Music's Up Next for the seed track,
// which generates an automatic mix based on the artist/song.
export const artistRadio: RadioStrategy = {
  name: 'Artist Radio',
  async generateTracks(seedVideoId: string): Promise<MusicTrack[]> {
    return getRadioTracks(seedVideoId);
  },
};
