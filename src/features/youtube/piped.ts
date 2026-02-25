// Piped API — proxy for YouTube stream URLs.
// Piped handles all YouTube anti-bot measures server-side and returns
// direct URLs that work with any HTTP client (ExoPlayer, fetch, etc.)

import type { StreamInfo, AudioQuality } from './types';

// Public Piped API instances — fallback through them if one fails
const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://pipedapi-libre.kavin.rocks',
  'https://piped-api.lunar.icu',
];

let currentInstanceIndex = 0;

function getBaseUrl(): string {
  return PIPED_INSTANCES[currentInstanceIndex];
}

function rotateInstance(): void {
  currentInstanceIndex = (currentInstanceIndex + 1) % PIPED_INSTANCES.length;
  if (__DEV__) console.log('[piped] rotated to instance:', getBaseUrl());
}

interface PipedAudioStream {
  url: string;
  bitrate: number;
  codec: string;
  format: string;
  mimeType: string;
  quality: string;
  videoOnly: boolean;
  contentLength?: number;
}

interface PipedStreamsResponse {
  title: string;
  duration: number;
  audioStreams: PipedAudioStream[];
  thumbnailUrl?: string;
}

// Preferred codecs by quality
const QUALITY_PREFERENCE: Record<AudioQuality, { maxBitrate: number; preferOpus: boolean }> = {
  high: { maxBitrate: Infinity, preferOpus: true },
  medium: { maxBitrate: 130000, preferOpus: true },
  low: { maxBitrate: 70000, preferOpus: false },
};

function selectBestAudio(
  streams: PipedAudioStream[],
  quality: AudioQuality,
): PipedAudioStream | null {
  const prefs = QUALITY_PREFERENCE[quality];

  // Filter audio-only streams
  const audioOnly = streams.filter((s) => !s.videoOnly);
  if (audioOnly.length === 0) return null;

  // Sort by bitrate descending
  const sorted = [...audioOnly].sort((a, b) => b.bitrate - a.bitrate);

  // For high quality, just pick the best
  if (quality === 'high') {
    // Prefer opus for better quality at same bitrate
    const opus = sorted.find((s) => s.codec === 'opus');
    return opus ?? sorted[0];
  }

  // For medium/low, find the best that fits under maxBitrate
  const candidates = sorted.filter((s) => s.bitrate <= prefs.maxBitrate);
  if (candidates.length === 0) {
    // All streams exceed max — pick the lowest bitrate
    return sorted[sorted.length - 1];
  }

  if (prefs.preferOpus) {
    const opus = candidates.find((s) => s.codec === 'opus');
    if (opus) return opus;
  }

  return candidates[0];
}

// Fetch stream URL from Piped API with instance fallback
export async function getPipedStreamUrl(
  videoId: string,
  quality: AudioQuality = 'high',
): Promise<StreamInfo> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < PIPED_INSTANCES.length; attempt++) {
    const baseUrl = getBaseUrl();
    const url = `${baseUrl}/streams/${videoId}`;

    if (__DEV__) console.log('[piped] fetching:', url);

    try {
      const response = await fetch(url, {
        headers: { 'Accept': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`Piped API ${response.status}: ${response.statusText}`);
      }

      const data: PipedStreamsResponse = await response.json();

      if (!data.audioStreams || data.audioStreams.length === 0) {
        throw new Error('No audio streams in Piped response');
      }

      if (__DEV__) {
        console.log('[piped] audio streams:', data.audioStreams.length,
          'codecs:', [...new Set(data.audioStreams.map((s) => s.codec))].join(','));
      }

      const selected = selectBestAudio(data.audioStreams, quality);
      if (!selected) {
        throw new Error('No suitable audio stream found');
      }

      if (__DEV__) {
        console.log('[piped] selected:', selected.codec, selected.quality,
          'bitrate:', selected.bitrate, 'mime:', selected.mimeType);
      }

      return {
        url: selected.url,
        itag: 0, // Piped doesn't expose itag
        mimeType: selected.mimeType,
        bitrate: selected.bitrate,
        contentLength: selected.contentLength ?? 0,
        expiresAt: Date.now() + 5 * 60 * 60 * 1000, // 5 hours
      };
    } catch (e: any) {
      lastError = e;
      if (__DEV__) console.warn('[piped] instance failed:', baseUrl, e?.message);
      rotateInstance();
    }
  }

  throw lastError ?? new Error('All Piped instances failed');
}
