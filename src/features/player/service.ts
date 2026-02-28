import TrackPlayer, { Event, State } from 'react-native-track-player';
import { checkEndOfTrackTimer } from './sleepTimer';
import { shouldCrossfade, executeCrossfade, cancelCrossfade } from './crossfade';

// --- Auto-advance workaround ---
// The patched ExoPlayer/Cronet build doesn't reliably emit PlaybackState or
// PlaybackQueueEnded events to JS. We work around this with two mechanisms:
//   1) Proactive: use PlaybackProgressUpdated (which DOES fire) to pre-resolve
//      the next track ~30s before the current one ends, so ExoPlayer auto-advances.
//      We start early because Android suspends WebView JS in background.
//   2) Reactive: poll getPlaybackState() every 1.5s to detect "Ended" state and
//      trigger auto-queue as a fallback.

let endPreResolvedForTrackId: string | null = null;
let isHandlingAutoAdvance = false;

// Proactive: ensure the next track is in the native queue before the current ends
async function ensureNextTrackQueued() {
  if (isHandlingAutoAdvance) return;
  isHandlingAutoAdvance = true;
  try {
    const tpQueue = await TrackPlayer.getQueue();
    const activeIdx = await TrackPlayer.getActiveTrackIndex();
    if (activeIdx === undefined) return;

    const activeTrack = tpQueue[activeIdx];
    if (!activeTrack) return;

    // Already pre-resolved for this track
    if (activeTrack.id === endPreResolvedForTrackId) return;

    // Only act if we're on the last track in the native queue
    if (activeIdx < tpQueue.length - 1) return;

    const { usePlayerStore } = await import('@/core/store/playerStore');
    const store = usePlayerStore.getState();
    const nextZustandIndex = store.currentIndex + 1;

    if (nextZustandIndex < store.queue.length) {
      // Zustand queue has more tracks — pre-resolve into native queue
      console.log('[service] Pre-resolving next track before current ends');
      const { preResolveFromQueue } = await import('./playTrack');
      await preResolveFromQueue(nextZustandIndex);
    } else {
      // No more tracks — trigger auto-queue first
      console.log('[service] Triggering auto-queue before track ends');
      const { triggerAutoQueue } = await import('./autoQueue');
      const added = await triggerAutoQueue();
      if (added) {
        const { preResolveFromQueue } = await import('./playTrack');
        const updated = usePlayerStore.getState();
        if (nextZustandIndex < updated.queue.length) {
          await preResolveFromQueue(nextZustandIndex);
        }
      }
    }
    // Only mark as pre-resolved AFTER success — allows retries on failure
    endPreResolvedForTrackId = activeTrack.id;
  } catch (err) {
    console.error('[service] ensureNextTrackQueued failed:', err);
    // Don't set endPreResolvedForTrackId — allow retry on next poll cycle
  } finally {
    isHandlingAutoAdvance = false;
  }
}

// Reactive: poll playback state every 1.5s for two purposes:
//   1) While playing: pre-resolve next track ~10s before end (proactive, in case
//      PlaybackProgressUpdated doesn't fire reliably with patched ExoPlayer).
//   2) When ended: detect Ended state and play the next queued track.
//
// YouTube often rejects the first few PoToken attempts with "Sign in to confirm
// you're not a bot" but succeeds after retries. The poll loop handles this by
// skipping to the next track on failure and retrying each poll cycle.
let lastPolledState: State | undefined;
let isHandlingEnded = false;
const MAX_ENDED_RETRIES = 8;
let endedRetryCount = 0;

async function pollPlaybackState() {
  try {
    const { state } = await TrackPlayer.getPlaybackState();

    // --- While playing: proactively pre-resolve next track before current ends ---
    if (state === State.Playing) {
      endedRetryCount = 0; // Reset retries when playing
      try {
        const { position, duration } = await TrackPlayer.getProgress();
        if (duration > 0 && position >= duration - 30) {
          ensureNextTrackQueued();
        }
      } catch { /* ignore */ }
    }

    // --- When ended: play next track or auto-queue ---
    if (state === State.Ended && !isHandlingEnded) {
      if (endedRetryCount >= MAX_ENDED_RETRIES) return; // Give up after too many attempts

      isHandlingEnded = true;
      try {
        const { usePlayerStore } = await import('@/core/store/playerStore');
        const store = usePlayerStore.getState();

        // Skip if queue is empty (e.g. app just started, stale Ended state)
        if (store.queue.length === 0) {
          isHandlingEnded = false;
          return;
        }

        // Check if ensureNextTrackQueued already pre-resolved a track into
        // the native TrackPlayer queue. If so, just skip to it (no WebView needed).
        const tpQueue = await TrackPlayer.getQueue();
        const activeIdx = await TrackPlayer.getActiveTrackIndex();
        if (activeIdx !== undefined && activeIdx < tpQueue.length - 1) {
          console.log('[service] Native queue has pre-resolved track, skipping to it');
          await TrackPlayer.skipToNext();
          const nextIndex = store.currentIndex + 1;
          if (nextIndex < store.queue.length) {
            store.setCurrentIndex(nextIndex);
          }
          const { preResolveFromQueue } = await import('./playTrack');
          preResolveFromQueue(nextIndex + 1).catch(() => {});
          endedRetryCount = 0;
          return;
        }

        // Ensure we have tracks to play (auto-queue if needed)
        let nextIndex = store.currentIndex + 1;
        if (nextIndex >= store.queue.length) {
          console.log('[service] End of queue — triggering auto-queue');
          const { triggerAutoQueue } = await import('./autoQueue');
          const added = await triggerAutoQueue();
          if (!added) {
            console.log('[service] Auto-queue returned no tracks');
            endedRetryCount = MAX_ENDED_RETRIES; // Stop retrying
            return;
          }
        }

        // Try to play the next track. On failure (e.g. bot detection), skip
        // to the following track and let the next poll cycle retry.
        const updated = usePlayerStore.getState();
        nextIndex = store.currentIndex + 1;
        if (nextIndex >= updated.queue.length) return;

        const nextTrack = updated.queue[nextIndex];
        endedRetryCount++;
        console.log(`[service] Trying track ${nextIndex} (attempt ${endedRetryCount}/${MAX_ENDED_RETRIES}):`, nextTrack.title);

        try {
          // Re-check native queue — pre-resolution may have completed since our earlier check
          const tpQueue2 = await TrackPlayer.getQueue();
          const activeIdx2 = await TrackPlayer.getActiveTrackIndex();
          if (activeIdx2 !== undefined && activeIdx2 < tpQueue2.length - 1) {
            console.log('[service] Pre-resolved track appeared, using skipToNext');
            await TrackPlayer.skipToNext();
            updated.setCurrentIndex(nextIndex);
            const { preResolveFromQueue } = await import('./playTrack');
            preResolveFromQueue(nextIndex + 1).catch(() => {});
            endedRetryCount = 0;
            return;
          }

          const { playTrackDirect, preResolveFromQueue } = await import('./playTrack');
          await playTrackDirect(nextTrack);
          // Success!
          updated.setCurrentIndex(nextIndex);
          endedRetryCount = 0;
          preResolveFromQueue(nextIndex + 1).catch(() => {});
        } catch (err) {
          console.warn('[service] Failed to play, skipping to next:', (err as Error)?.message);
          // Advance index so next poll tries the following track
          updated.setCurrentIndex(nextIndex);
          // Don't set endedRetryCount to max — let it retry with next track
        }
      } catch (err) {
        console.error('[service] Poll ended handler error:', err);
      } finally {
        isHandlingEnded = false;
      }
    }

    lastPolledState = state;
  } catch {
    // Player not ready — ignore
  }
}

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
      } else {
        // At end of native queue — resolve next from Zustand or auto-queue
        const { usePlayerStore } = await import('@/core/store/playerStore');
        const store = usePlayerStore.getState();
        const nextIndex = store.currentIndex + 1;

        if (nextIndex < store.queue.length) {
          // Zustand has more tracks, resolve and play the next one
          const nextTrack = store.queue[nextIndex];
          store.setCurrentIndex(nextIndex);
          const { playTrackDirect, preResolveFromQueue } = await import('./playTrack');
          await playTrackDirect(nextTrack);
          preResolveFromQueue(nextIndex + 1).catch(() => {});
        } else {
          // No more tracks — try auto-queue
          const { triggerAutoQueue } = await import('./autoQueue');
          const added = await triggerAutoQueue();
          if (added) {
            const updated = usePlayerStore.getState();
            const nextTrack = updated.queue[nextIndex];
            if (nextTrack) {
              updated.setCurrentIndex(nextIndex);
              const { playTrackDirect, preResolveFromQueue } = await import('./playTrack');
              await playTrackDirect(nextTrack);
              preResolveFromQueue(nextIndex + 1).catch(() => {});
            }
          }
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
  TrackPlayer.addEventListener(Event.PlaybackActiveTrackChanged, async (event) => {
    console.log('[service] PlaybackActiveTrackChanged:', event.track?.id ?? 'null');
    checkEndOfTrackTimer();

    // Engagement tracking: finalize previous track's listen session
    if ((event as any).lastTrack?.id) {
      try {
        const { trackPlayEnded } = await import('@/features/recommendation/engagement');
        trackPlayEnded((event as any).lastTrack.id).catch(() => {});
      } catch { /* ignore */ }
    }

    // Sync Zustand currentIndex with the actual playing track.
    // When TrackPlayer auto-advances through the native queue, currentIndex
    // falls out of sync because only manual skips update it.
    try {
      const trackId = event.track?.id;
      if (trackId) {
        const { usePlayerStore } = await import('@/core/store/playerStore');
        const store = usePlayerStore.getState();
        const idx = store.queue.findIndex((t) => t.id === trackId);
        if (idx !== -1 && idx !== store.currentIndex) {
          console.log('[service] Syncing currentIndex:', store.currentIndex, '→', idx);
          store.setCurrentIndex(idx);
        }

        // Auto-queue: pre-fetch more tracks when near the end of the queue
        const remaining = store.queue.length - (idx !== -1 ? idx : store.currentIndex) - 1;
        if (remaining <= 1 && store.queue.length > 0) {
          const { triggerAutoQueue } = await import('./autoQueue');
          triggerAutoQueue().catch(() => {});
        }
      }
    } catch { /* ignore */ }
  });

  // Auto-queue: when the native queue ends naturally (last track finishes),
  // fetch related tracks and continue playback.
  // Guarded by isHandlingEnded to prevent race with pollPlaybackState.
  TrackPlayer.addEventListener(Event.PlaybackQueueEnded, async () => {
    console.log('[service] PlaybackQueueEnded — checking auto-queue');
    if (isHandlingEnded) {
      console.log('[service] PlaybackQueueEnded skipped — poll already handling');
      return;
    }
    isHandlingEnded = true;
    try {
      const { usePlayerStore } = await import('@/core/store/playerStore');
      const store = usePlayerStore.getState();
      const nextIndex = store.currentIndex + 1;

      // If Zustand queue already has more tracks (pre-fetched), play them
      if (nextIndex < store.queue.length) {
        const nextTrack = store.queue[nextIndex];
        store.setCurrentIndex(nextIndex);
        const { playTrackDirect, preResolveFromQueue } = await import('./playTrack');
        await playTrackDirect(nextTrack);
        preResolveFromQueue(nextIndex + 1).catch(() => {});
        endedRetryCount = 0;
        return;
      }

      // Otherwise, fetch new related tracks
      const { triggerAutoQueue } = await import('./autoQueue');
      const added = await triggerAutoQueue();
      if (added) {
        const updated = usePlayerStore.getState();
        const nextTrack = updated.queue[nextIndex];
        if (nextTrack) {
          updated.setCurrentIndex(nextIndex);
          const { playTrackDirect, preResolveFromQueue } = await import('./playTrack');
          await playTrackDirect(nextTrack);
          preResolveFromQueue(nextIndex + 1).catch(() => {});
          endedRetryCount = 0;
        }
      }
    } catch (err) {
      console.error('[service] Auto-queue on queue end failed:', err);
    } finally {
      isHandlingEnded = false;
    }
  });

  // Log state changes and errors
  TrackPlayer.addEventListener(Event.PlaybackState, (event) => {
    console.log('[service] PlaybackState:', JSON.stringify(event));
  });

  TrackPlayer.addEventListener(Event.PlaybackError, (event) => {
    console.error('[service] PlaybackError:', JSON.stringify(event));
  });

  // Crossfade + auto-advance: monitor progress for upcoming track end
  TrackPlayer.addEventListener(Event.PlaybackProgressUpdated, (event) => {
    if (shouldCrossfade(event.position, event.duration)) {
      executeCrossfade();
    }

    // Proactive auto-advance: 30 seconds before end, pre-resolve next track
    // into the native queue so ExoPlayer auto-advances seamlessly.
    // We start early to maximize chances of resolving while WebView is active
    // (Android suspends WebView JS in background).
    if (
      event.duration > 0 &&
      event.position >= event.duration - 30 &&
      event.duration - event.position > 0
    ) {
      ensureNextTrackQueued();
    }
  });

  // Poll playback state every 2 seconds:
  // - While playing: pre-resolve next track before current ends (proactive)
  // - When ended: detect end-of-playback and auto-queue (reactive fallback)
  // Required because patched ExoPlayer doesn't reliably emit native events.
  setInterval(pollPlaybackState, 1500);
}
