// Stream URL resolver via local proxy server.
// The server runs yt-dlp on the host machine which handles all YouTube
// anti-bot measures. The emulator connects via 10.0.2.2.
//
// For production, this will need to be replaced with a cloud proxy
// or an on-device solution. For now, this gets audio playback working.

import type { StreamInfo, AudioQuality } from './types';

// 10.0.2.2 is the host machine from Android emulator
// For real device testing, use your machine's local IP
const STREAM_SERVER = __DEV__
  ? 'http://10.0.2.2:3333'
  : 'http://10.0.2.2:3333'; // TODO: production endpoint

export async function getStreamViaAndroidVR(
  videoId: string,
  _quality: AudioQuality = 'high',
): Promise<StreamInfo> {
  if (__DEV__) console.log('[stream] resolving via proxy:', videoId);

  const response = await fetch(`${STREAM_SERVER}/stream/${videoId}`);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Stream server error ${response.status}: ${text}`);
  }

  const data = await response.json();

  if (!data.url) {
    throw new Error(data.error || 'No stream URL returned');
  }

  if (__DEV__) console.log('[stream] got URL, length:', data.url.length);

  return {
    url: data.url,
    itag: 0,
    mimeType: 'audio/webm',
    bitrate: 0,
    contentLength: 0,
    expiresAt: Date.now() + 5 * 60 * 60 * 1000,
  };
}
