import { resolveWithFallback } from './client';
import type { StreamInfo, AudioQuality } from './types';
import { QUALITY_ITAGS } from './types';

const CACHE_TTL = 5 * 60 * 60 * 1000; // 5 hours
const streamCache = new Map<string, StreamInfo>();

const MIN_REQUEST_GAP_MS = 1500;
let lastRequestTime = 0;

async function waitForRateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_REQUEST_GAP_MS && lastRequestTime > 0) {
    const delay = MIN_REQUEST_GAP_MS - elapsed;
    if (__DEV__) console.log(`[streams] rate-limit wait: ${delay}ms`);
    await new Promise((r) => setTimeout(r, delay));
  }
  lastRequestTime = Date.now();
}

// Resolve the best audio stream URL.
// The stream client is created WITH po_token, so the /player API request
// includes it automatically. No need to manually append &pot= to URLs.
export async function getStreamUrl(
  videoId: string,
  quality: AudioQuality = 'high',
): Promise<StreamInfo> {
  const cacheKey = `${videoId}:${quality}`;
  const cached = streamCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached;
  }

  const streamInfo = await resolveWithFallback(async (yt) => {
    await waitForRateLimit();
    const info = await yt.getBasicInfo(videoId);

    const allAdaptive: any[] = info.streaming_data?.adaptive_formats ?? [];
    const allFormats: any[] = info.streaming_data?.formats ?? [];

    const audioFormats = allAdaptive.filter((f: any) => {
      if (typeof f.has_audio === 'boolean' && typeof f.has_video === 'boolean') {
        return f.has_audio && !f.has_video;
      }
      return (f.mime_type ?? '').startsWith('audio/');
    });

    const candidates = audioFormats.length > 0
      ? audioFormats
      : allFormats.filter((f: any) =>
          (f.mime_type ?? '').startsWith('audio/') || f.has_audio === true
        );

    if (__DEV__) {
      console.log('[streams] audio candidates:', candidates.length,
        'itags:', candidates.map((f: any) => f.itag).join(','));
    }

    if (candidates.length === 0) {
      throw new Error(`No audio stream found for ${videoId}`);
    }

    const preferredItags = QUALITY_ITAGS[quality];
    let selectedFormat: any = null;

    for (const itag of preferredItags) {
      selectedFormat = candidates.find((f: any) => f.itag === itag);
      if (selectedFormat) break;
    }

    if (!selectedFormat) {
      selectedFormat = [...candidates].sort(
        (a: any, b: any) => (b.bitrate ?? 0) - (a.bitrate ?? 0),
      )[0];
    }

    if (__DEV__) {
      console.log('[streams] selected itag:', selectedFormat.itag,
        'mime:', selectedFormat.mime_type, 'bitrate:', selectedFormat.bitrate);
    }

    const url = await selectedFormat.decipher(yt.session.player);
    if (!url) throw new Error(`Decipher failed for ${videoId}`);

    if (__DEV__) console.log('[streams] decipher ok, url length:', url.length);

    const contentLength: number = parseInt(selectedFormat.content_length) || 0;

    return {
      url,
      itag: selectedFormat.itag,
      mimeType: selectedFormat.mime_type ?? 'audio/webm',
      bitrate: selectedFormat.bitrate ?? 0,
      contentLength,
      expiresAt: Date.now() + CACHE_TTL,
    } as StreamInfo;
  });

  streamCache.set(cacheKey, streamInfo);
  return streamInfo;
}

export function cleanStreamCache() {
  const now = Date.now();
  for (const [key, info] of streamCache) {
    if (info.expiresAt <= now) {
      streamCache.delete(key);
    }
  }
}

export function invalidateStream(videoId: string) {
  for (const key of streamCache.keys()) {
    if (key.startsWith(videoId)) {
      streamCache.delete(key);
    }
  }
}
