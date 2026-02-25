import TrackPlayer from 'react-native-track-player';
import { useTimerStore } from '@/core/store/timerStore';

let intervalId: ReturnType<typeof setInterval> | null = null;

// Start the sleep timer tick loop. Called once from the app root.
export function startSleepTimerLoop() {
  if (intervalId) return;
  intervalId = setInterval(() => {
    const state = useTimerStore.getState();
    if (!state.isActive || state.endOfTrack) return;

    state.tick(Date.now());

    if (state.remainingMs <= 0) {
      TrackPlayer.pause();
      state.cancel();
    }
  }, 1000);
}

// Handle "end of track" mode — call this when a track ends.
export function checkEndOfTrackTimer() {
  const state = useTimerStore.getState();
  if (state.isActive && state.endOfTrack) {
    TrackPlayer.pause();
    state.cancel();
  }
}

export function stopSleepTimerLoop() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

// Format remaining time as "MM:SS"
export function formatRemaining(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
