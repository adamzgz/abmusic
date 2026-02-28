import { useCallback, useEffect, useRef, useState } from 'react';
import TrackPlayer, {
  useActiveTrack,
  usePlaybackState,
  useProgress,
  State,
  Event,
} from 'react-native-track-player';
import { cancelCrossfade } from './crossfade';

// Main hook for interacting with the audio player.
// Wraps react-native-track-player hooks with a cleaner API.
//
// Note: The patched ExoPlayer/KotlinAudio build doesn't reliably emit
// PlaybackState events to JS, so usePlaybackState().state stays undefined.
// We work around this by polling getPlaybackState() on an interval.
export function usePlayer() {
  const hookTrack = useActiveTrack();
  const hookState = usePlaybackState();
  const progress = useProgress();

  // Polled state as fallback when native events don't fire (patched ExoPlayer)
  const [polledState, setPolledState] = useState<State | undefined>(undefined);
  const [polledTrack, setPolledTrack] = useState<any>(undefined);
  const polledRef = useRef<{ state?: State; trackId?: string }>({});

  useEffect(() => {
    let mounted = true;

    const poll = async () => {
      try {
        const [pb, track] = await Promise.all([
          TrackPlayer.getPlaybackState(),
          TrackPlayer.getActiveTrack(),
        ]);
        if (!mounted) return;
        if (pb.state !== polledRef.current.state) {
          polledRef.current.state = pb.state;
          setPolledState(pb.state);
        }
        const newId = track?.id ?? undefined;
        if (newId !== polledRef.current.trackId) {
          polledRef.current.trackId = newId;
          setPolledTrack(track ?? undefined);
        }
      } catch {
        // Player not yet set up — ignore
      }
    };

    poll();
    const id = setInterval(poll, 500);
    return () => { mounted = false; clearInterval(id); };
  }, []);

  // Also update polled state when events do fire
  useEffect(() => {
    const s1 = TrackPlayer.addEventListener(Event.PlaybackActiveTrackChanged, (e) => {
      console.log('[usePlayer] PlaybackActiveTrackChanged track:', e.track?.id ?? 'null');
    });
    const s2 = TrackPlayer.addEventListener(Event.PlaybackState, (e) => {
      console.log('[usePlayer] PlaybackState:', JSON.stringify(e));
      if (e.state !== undefined) {
        polledRef.current.state = e.state;
        setPolledState(e.state);
      }
    });
    const s3 = TrackPlayer.addEventListener(Event.PlaybackError, (e) => {
      console.error('[usePlayer] PlaybackError:', JSON.stringify(e));
    });
    return () => { s1.remove(); s2.remove(); s3.remove(); };
  }, []);

  // Prefer hook values if available, fall back to polled values
  const activeTrack = hookTrack ?? polledTrack;
  const effectiveState = hookState.state ?? polledState;
  const isPlaying = effectiveState === State.Playing;
  const isBuffering = effectiveState === State.Buffering;
  const isLoading = effectiveState === State.Loading;

  const togglePlayback = useCallback(async () => {
    // Always query fresh state — don't rely on potentially stale hook value
    const fresh = await TrackPlayer.getPlaybackState();
    const playing = fresh.state === State.Playing;
    console.log('[usePlayer] togglePlayback fresh:', fresh.state, 'playing:', playing);
    if (playing) {
      await TrackPlayer.pause();
    } else {
      await TrackPlayer.play();
    }
  }, []);

  const skipToNext = useCallback(async () => {
    cancelCrossfade(); // Restore volume if crossfading
    const { usePlayerStore } = await import('@/core/store/playerStore');
    const store = usePlayerStore.getState();
    const { queue, currentIndex, repeatMode, shuffle } = store;

    // Repeat one: restart current track
    if (repeatMode === 'one') {
      await TrackPlayer.seekTo(0);
      await TrackPlayer.play();
      return;
    }

    // Calculate next index
    let nextIndex: number;
    if (shuffle) {
      // Pick a random track that's not the current one
      if (queue.length <= 1) return;
      do {
        nextIndex = Math.floor(Math.random() * queue.length);
      } while (nextIndex === currentIndex);
    } else {
      nextIndex = currentIndex + 1;
    }

    // Handle end of queue
    if (nextIndex >= queue.length) {
      if (repeatMode === 'all') {
        nextIndex = 0; // wrap around
      } else {
        return; // no next track
      }
    }

    // Try native skip if sequential and tracks are pre-resolved
    if (!shuffle && nextIndex === currentIndex + 1) {
      try {
        const tpQueue = await TrackPlayer.getQueue();
        const currentIdx = await TrackPlayer.getActiveTrackIndex();
        if (currentIdx !== undefined && currentIdx < tpQueue.length - 1) {
          await TrackPlayer.skipToNext();
          store.setCurrentIndex(nextIndex);
          return;
        }
      } catch { /* no next in native queue */ }
    }

    // Fallback: resolve and play via Zustand queue
    const nextTrack = queue[nextIndex];
    store.setCurrentIndex(nextIndex);
    const { playTrackDirect, preResolveFromQueue } = await import('./playTrack');
    await playTrackDirect(nextTrack);
    // Pre-resolve upcoming tracks so native skip works next time
    preResolveFromQueue(nextIndex + 1).catch(() => {});
  }, []);

  const skipToPrevious = useCallback(async () => {
    cancelCrossfade(); // Restore volume if crossfading
    // If more than 3s in, just restart current track
    try {
      const { position } = await TrackPlayer.getProgress();
      if (position > 3) {
        await TrackPlayer.seekTo(0);
        return;
      }
    } catch { /* ignore */ }

    const { usePlayerStore } = await import('@/core/store/playerStore');
    const store = usePlayerStore.getState();
    const { queue, currentIndex, repeatMode } = store;

    // Repeat one: restart current track
    if (repeatMode === 'one') {
      await TrackPlayer.seekTo(0);
      await TrackPlayer.play();
      return;
    }

    let prevIndex = currentIndex - 1;

    // Handle beginning of queue
    if (prevIndex < 0) {
      if (repeatMode === 'all') {
        prevIndex = queue.length - 1; // wrap to end
      } else {
        await TrackPlayer.seekTo(0); // restart current
        return;
      }
    }

    // Try native skip if sequential
    if (prevIndex === currentIndex - 1) {
      try {
        const currentIdx = await TrackPlayer.getActiveTrackIndex();
        if (currentIdx !== undefined && currentIdx > 0) {
          await TrackPlayer.skipToPrevious();
          store.setCurrentIndex(prevIndex);
          return;
        }
      } catch { /* no previous in native queue */ }
    }

    // Fallback: resolve and play
    const prevTrack = queue[prevIndex];
    store.setCurrentIndex(prevIndex);
    const { playTrackDirect } = await import('./playTrack');
    await playTrackDirect(prevTrack);
  }, []);

  const seekTo = useCallback(async (position: number) => {
    await TrackPlayer.seekTo(position);
  }, []);

  return {
    activeTrack,
    isPlaying,
    isBuffering,
    isLoading,
    progress,
    togglePlayback,
    skipToNext,
    skipToPrevious,
    seekTo,
  };
}
