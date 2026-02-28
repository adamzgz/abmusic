// Direct InnerTube android_vr client for stream URL resolution.
// Uses clientName=28 (ANDROID_VR) which returns pre-authenticated URLs
// that don't need sig/n-transform (no decipher needed).
// The API call goes through the WebView (Chrome TLS) to avoid fingerprint blocks.

import { youtubeApiCallViaWebView, getVisitorData, ensureYouTubeSession, mintPoToken, isPoTokenReady } from '@/features/potoken/PoTokenProvider';
import type { StreamInfo, AudioQuality } from './types';
import { QUALITY_ITAGS } from './types';

const PLAYER_ENDPOINT = 'https://www.youtube.com/youtubei/v1/player';

function buildVRContext() {
  const visitorData = getVisitorData();
  return {
    client: {
      clientName: 'ANDROID_VR',
      clientVersion: '1.71.26',
      deviceMake: 'Oculus',
      deviceModel: 'Quest 3',
      androidSdkVersion: 32,
      osName: 'Android',
      osVersion: '12L',
      hl: 'en',
      gl: 'US',
      ...(visitorData ? { visitorData } : {}),
    },
  };
}

const CACHE_TTL = 5 * 60 * 60 * 1000; // 5 hours
const streamCache = new Map<string, StreamInfo>();

const MIN_REQUEST_GAP_MS = 1500;
let lastRequestTime = 0;

async function waitForRateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_REQUEST_GAP_MS && lastRequestTime > 0) {
    const delay = MIN_REQUEST_GAP_MS - elapsed;
    if (__DEV__) console.log(`[innertube-vr] rate-limit wait: ${delay}ms`);
    await new Promise((r) => setTimeout(r, delay));
  }
  lastRequestTime = Date.now();
}

interface AdaptiveFormat {
  itag: number;
  url?: string;
  signatureCipher?: string;
  mimeType: string;
  bitrate: number;
  contentLength?: string;
  audioQuality?: string;
  audioChannels?: number;
}

function selectBestAudio(
  formats: AdaptiveFormat[],
  quality: AudioQuality,
): AdaptiveFormat | null {
  // Filter audio-only formats that have a direct URL (no signatureCipher)
  const audioFormats = formats.filter(
    (f) => f.mimeType.startsWith('audio/') && f.url && !f.signatureCipher,
  );

  if (audioFormats.length === 0) return null;

  if (__DEV__) {
    console.log(
      '[innertube-vr] audio candidates:',
      audioFormats.length,
      'itags:',
      audioFormats.map((f) => f.itag).join(','),
    );
  }

  // Try preferred itags first
  const preferredItags = QUALITY_ITAGS[quality];
  for (const itag of preferredItags) {
    const match = audioFormats.find((f) => f.itag === itag);
    if (match) return match;
  }

  // Fallback: highest bitrate audio
  return [...audioFormats].sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0))[0];
}

export async function getStreamViaInnertubeVR(
  videoId: string,
  quality: AudioQuality = 'high',
): Promise<StreamInfo> {
  // Check cache
  const cacheKey = `vr:${videoId}:${quality}`;
  const cached = streamCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    if (__DEV__) console.log('[innertube-vr] cache hit:', videoId);
    return cached;
  }

  if (__DEV__) console.log('[innertube-vr] resolving:', videoId);

  await waitForRateLimit();

  // Ensure session (cookies + visitorData) is ready BEFORE building the body
  await ensureYouTubeSession();

  const context = buildVRContext();
  if (__DEV__) console.log('[innertube-vr] hasVisitorData:', !!context.client.visitorData);

  // Mint a PO Token bound to this videoId to prove we're not a bot.
  // Without this, YouTube may return "Sign in to confirm you're not a bot".
  let poToken: string | undefined;
  if (isPoTokenReady()) {
    try {
      poToken = await mintPoToken(videoId);
      if (__DEV__) console.log('[innertube-vr] minted poToken, length:', poToken.length);
    } catch (e: any) {
      if (__DEV__) console.warn('[innertube-vr] poToken mint failed:', e?.message);
    }
  }

  const body: any = {
    videoId,
    context,
    contentCheckOk: true,
    racyCheckOk: true,
    ...(poToken ? { serviceIntegrityDimensions: { poToken } } : {}),
  };

  const data = await youtubeApiCallViaWebView(PLAYER_ENDPOINT, body);

  // Check playability
  const playability = data?.playabilityStatus;
  if (playability?.status !== 'OK') {
    const reason = playability?.reason || playability?.status || 'unknown';
    throw new Error(`[innertube-vr] not playable: ${reason}`);
  }

  const adaptiveFormats: AdaptiveFormat[] =
    data?.streamingData?.adaptiveFormats ?? [];

  if (adaptiveFormats.length === 0) {
    throw new Error(`[innertube-vr] no adaptive formats for ${videoId}`);
  }

  const selected = selectBestAudio(adaptiveFormats, quality);
  if (!selected || !selected.url) {
    throw new Error(`[innertube-vr] no suitable audio format for ${videoId}`);
  }

  if (__DEV__) {
    console.log(
      '[innertube-vr] got URL, itag:',
      selected.itag,
      'mime:',
      selected.mimeType,
      'bitrate:',
      selected.bitrate,
    );
  }

  const streamInfo: StreamInfo = {
    url: selected.url,
    itag: selected.itag,
    mimeType: selected.mimeType,
    bitrate: selected.bitrate,
    contentLength: parseInt(selected.contentLength ?? '0') || 0,
    expiresAt: Date.now() + CACHE_TTL,
  };

  streamCache.set(cacheKey, streamInfo);
  return streamInfo;
}
