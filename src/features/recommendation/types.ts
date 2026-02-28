import type { MusicTrack } from '@/features/youtube/types';

export interface EngagementData {
  trackId: string;
  playCount: number;
  skipCount: number;
  totalListenMs: number;
  lastPlayedAt: number | null;
  lastSkippedAt: number | null;
}

export interface ArtistAffinityData {
  artistKey: string;
  artistName: string;
  score: number;
  playCount: number;
  skipCount: number;
  updatedAt: number;
}

export interface ScoredCandidate {
  track: MusicTrack;
  score: number;
  source: 'youtube' | 'lastfm';
}

export interface PlaySession {
  startedAt: number;
  durationSec: number;
  trackId: string;
}
