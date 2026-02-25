import type { MusicTrack } from '../youtube/types';

// A radio strategy generates a queue of tracks given a seed.
export interface RadioStrategy {
  name: string;
  // Generate tracks based on a seed (track, artist, genre, etc.)
  generateTracks(seed: string): Promise<MusicTrack[]>;
}

export interface RadioState {
  isActive: boolean;
  strategyName: string | null;
  seed: string | null;
}
