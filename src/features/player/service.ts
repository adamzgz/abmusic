import TrackPlayer, { Event } from 'react-native-track-player';
import { checkEndOfTrackTimer } from './sleepTimer';
import { shouldCrossfade, executeCrossfade, cancelCrossfade } from './crossfade';

// This service runs even when the UI is destroyed (background playback).
// It handles remote events from lock screen / notification controls.
export async function PlaybackService() {
  TrackPlayer.addEventListener(Event.RemotePlay, () => TrackPlayer.play());
  TrackPlayer.addEventListener(Event.RemotePause, () => TrackPlayer.pause());
  TrackPlayer.addEventListener(Event.RemoteStop, () => TrackPlayer.reset());
  TrackPlayer.addEventListener(Event.RemoteNext, async () => {
    cancelCrossfade(); // Restore volume if crossfading
    try {
      const queue = await TrackPlayer.getQueue();
      const idx = await TrackPlayer.getActiveTrackIndex();
      if (idx !== undefined && idx < queue.length - 1) {
        await TrackPlayer.skipToNext();
        const { usePlayerStore } = await import('@/core/store/playerStore');
        const store = usePlayerStore.getState();
        if (store.currentIndex < store.queue.length - 1) {
          store.setCurrentIndex(store.currentIndex + 1);
        }
      }
    } catch { /* ignore */ }
  });
  TrackPlayer.addEventListener(Event.RemotePrevious, async () => {
    cancelCrossfade(); // Restore volume if crossfading
    try {
      const { position } = await TrackPlayer.getProgress();
      if (position > 3) {
        await TrackPlayer.seekTo(0);
        return;
      }
      const idx = await TrackPlayer.getActiveTrackIndex();
      if (idx !== undefined && idx > 0) {
        await TrackPlayer.skipToPrevious();
        const { usePlayerStore } = await import('@/core/store/playerStore');
        const store = usePlayerStore.getState();
        if (store.currentIndex > 0) {
          store.setCurrentIndex(store.currentIndex - 1);
        }
      }
    } catch { /* ignore */ }
  });
  TrackPlayer.addEventListener(Event.RemoteSeek, (event) => {
    TrackPlayer.seekTo(event.position);
  });

  // Sleep timer: check "end of track" mode when track changes
  TrackPlayer.addEventListener(Event.PlaybackActiveTrackChanged, (event) => {
    console.log('[service] PlaybackActiveTrackChanged:', event.track?.id ?? 'null');
    checkEndOfTrackTimer();
  });

  // Log state changes and errors
  TrackPlayer.addEventListener(Event.PlaybackState, (event) => {
    console.log('[service] PlaybackState:', JSON.stringify(event));
  });

  TrackPlayer.addEventListener(Event.PlaybackError, (event) => {
    console.error('[service] PlaybackError:', JSON.stringify(event));
  });

  // Crossfade: monitor progress for upcoming track end
  TrackPlayer.addEventListener(Event.PlaybackProgressUpdated, (event) => {
    if (shouldCrossfade(event.position, event.duration)) {
      executeCrossfade();
    }
  });
}
