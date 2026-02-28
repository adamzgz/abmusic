import TrackPlayer from 'react-native-track-player';
import { getStreamViaInnertubeVR } from '@/features/youtube/innertube-vr';
import { usePlayerStore } from '@/core/store/playerStore';
import { useSettingsStore } from '@/core/store/settingsStore';
import { addToHistory } from '@/features/library/history';
import { getOfflineUrl } from '@/features/cache/offlineCache';
import { cancelCrossfade } from './crossfade';
import type { MusicTrack } from '@/features/youtube/types';

// Resolve a playable URL: offline cache → InnerTube VR (WebView).
async function resolveForPlayback(trackId: string): Promise<string> {
  const offlineUrl = await getOfflineUrl(trackId);
  if (offlineUrl) return offlineUrl;

  const quality = useSettingsStore.getState().audioQuality;

  // InnerTube android_vr client via WebView (Chrome TLS)
  // Returns pre-authenticated URLs — no decipher/sig transform needed.
  const stream = await getStreamViaInnertubeVR(trackId, quality);
  if (__DEV__) {
    console.log('[resolve] VR url length:', stream.url.length,
      'itag:', stream.itag, 'mime:', stream.mimeType);
  }
  return stream.url;
}

// Play a track without resetting the logical queue (used by skip next/prev)
export async function playTrackDirect(track: MusicTrack) {
  cancelCrossfade(); // Restore volume to 1 if crossfade was in progress
  if (__DEV__) console.log('[playTrack] direct resolving:', track.id);
  const url = await resolveForPlayback(track.id);
  if (__DEV__) console.log('[playTrack] direct playing:', track.id);

  await TrackPlayer.reset();
  await TrackPlayer.add({
    id: track.id,
    url,
    title: track.title,
    artist: track.artist,
    artwork: track.thumbnail || undefined,
    duration: track.duration,
  });
  await TrackPlayer.play();
  addToHistory(track).catch(() => {});
}

// Play a single track
export async function playTrack(track: MusicTrack) {
  cancelCrossfade(); // Restore volume to 1 if crossfade was in progress
  if (__DEV__) console.log('[playTrack] resolving:', track.id);

  const url = await resolveForPlayback(track.id);

  if (__DEV__) console.log('[playTrack] playing:', track.id);

  await TrackPlayer.reset();
  await TrackPlayer.add({
    id: track.id,
    url,
    title: track.title,
    artist: track.artist,
    artwork: track.thumbnail || undefined,
    duration: track.duration,
  });
  await TrackPlayer.play();

  if (__DEV__) console.log('[playTrack] play() called');

  usePlayerStore.getState().setQueue([track], 0);
  addToHistory(track).catch(() => {});
}

// Play a list of tracks starting from a given index
export async function playTracks(tracks: MusicTrack[], startIndex = 0) {
  cancelCrossfade(); // Restore volume to 1 if crossfade was in progress
  const firstTrack = tracks[startIndex];
  const url = await resolveForPlayback(firstTrack.id);

  await TrackPlayer.reset();
  await TrackPlayer.add({
    id: firstTrack.id,
    url,
    title: firstTrack.title,
    artist: firstTrack.artist,
    artwork: firstTrack.thumbnail || undefined,
    duration: firstTrack.duration,
  });
  await TrackPlayer.play();

  usePlayerStore.getState().setQueue(tracks, startIndex);

  preResolveNext(tracks, startIndex + 1).catch(() => {});
}

// Pre-resolve upcoming tracks from the Zustand queue into the native TP queue.
// Called after a Zustand-fallback skip so that native skipToNext works for subsequent skips.
export async function preResolveFromQueue(fromIndex: number) {
  const { usePlayerStore } = await import('@/core/store/playerStore');
  const { queue } = usePlayerStore.getState();
  if (fromIndex >= queue.length) return;
  await preResolveNext(queue, fromIndex);
}

async function preResolveNext(tracks: MusicTrack[], fromIndex: number) {
  const PREFETCH_COUNT = 2;
  const end = Math.min(fromIndex + PREFETCH_COUNT, tracks.length);

  for (let i = fromIndex; i < end; i++) {
    const t = tracks[i];
    try {
      if (__DEV__) console.log(`[playTrack] pre-resolving ${i - fromIndex + 1}/${end - fromIndex}:`, t.id);
      const nextUrl = await resolveForPlayback(t.id);
      await TrackPlayer.add({
        id: t.id,
        url: nextUrl,
        title: t.title,
        artist: t.artist,
        artwork: t.thumbnail || undefined,
        duration: t.duration,
      });
      if (__DEV__) console.log(`[playTrack] pre-resolved ok:`, t.id);
    } catch (e: any) {
      if (__DEV__) console.warn(`[playTrack] pre-resolve failed for ${t.id}:`, e?.message);
    }
  }
}
