// Normalized track type used across the app.
// Decoupled from YouTube's internal data structures.
export interface MusicTrack {
  id: string; // YouTube video ID
  title: string;
  artist: string;
  artistId?: string;
  album?: string;
  albumId?: string;
  duration: number; // seconds
  thumbnail: string; // URL
}

export interface SearchResults {
  tracks: MusicTrack[];
  hasMore: boolean;
}

export interface StreamInfo {
  url: string;
  itag: number;
  mimeType: string;
  bitrate: number;
  contentLength: number; // bytes
  expiresAt: number; // timestamp
  headers?: Record<string, string>;
}

// Audio quality preference
export type AudioQuality = 'high' | 'medium' | 'low';

// Maps quality to preferred itags (Opus)
export const QUALITY_ITAGS: Record<AudioQuality, number[]> = {
  high: [251, 140], // Opus 160kbps, fallback AAC 128kbps
  medium: [250, 140], // Opus 70kbps, fallback AAC 128kbps
  low: [249, 250, 140], // Opus 50kbps, fallback 70kbps, fallback AAC
};
