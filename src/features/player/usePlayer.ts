import { useCallback, useEffect } from 'react';
import TrackPlayer, {
  useActiveTrack,
  usePlaybackState,
  useProgress,
  State,
  Event,
} from 'react-native-track-player';

// Main hook for interacting with the audio player.
// Wraps react-native-track-player hooks with a cleaner API.
export function usePlayer() {
  const activeTrack = useActiveTrack();
  const playbackState = usePlaybackState();
  const progress = useProgress();

  useEffect(() => {
    const s1 = TrackPlayer.addEventListener(Event.PlaybackActiveTrackChanged, (e) => {
      console.log('[usePlayer] PlaybackActiveTrackChanged track:', e.track?.id ?? 'null');
    });
    const s2 = TrackPlayer.addEventListener(Event.PlaybackState, (e) => {
      console.log('[usePlayer] PlaybackState:', JSON.stringify(e));
    });
    const s3 = TrackPlayer.addEventListener(Event.PlaybackError, (e) => {
      console.error('[usePlayer] PlaybackError:', JSON.stringify(e));
    });
    return () => { s1.remove(); s2.remove(); s3.remove(); };
  }, []);

  const isPlaying = playbackState.state === State.Playing;
  const isBuffering = playbackState.state === State.Buffering;
  const isLoading = playbackState.state === State.Loading;

  const togglePlayback = useCallback(async () => {
    console.log('[usePlayer] togglePlayback state:', playbackState.state, 'isPlaying:', isPlaying);
    if (isPlaying) {
      await TrackPlayer.pause();
    } else {
      await TrackPlayer.play();
    }
  }, [isPlaying, playbackState.state]);

  const skipToNext = useCallback(async () => {
    await TrackPlayer.skipToNext();
  }, []);

  const skipToPrevious = useCallback(async () => {
    await TrackPlayer.skipToPrevious();
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
