import TrackPlayer from 'react-native-track-player';
import { useSettingsStore } from '@/core/store/settingsStore';

// Simulated crossfade via volume fading.
// TrackPlayer doesn't support true overlap with two simultaneous streams,
// so we fade volume down → skip track → fade volume up.

const FADE_STEPS = 20;
let fadeTimers: ReturnType<typeof setTimeout>[] = [];
let isFading = false;

export function isCrossfading(): boolean {
  return isFading;
}

// Check if we should start crossfading based on current position and duration.
// Returns true if crossfade was triggered.
export function shouldCrossfade(position: number, duration: number): boolean {
  const { crossfadeDuration } = useSettingsStore.getState();
  if (crossfadeDuration <= 0 || duration <= 0) return false;
  if (isFading) return false;

  return position >= duration - crossfadeDuration && position < duration;
}

// Execute the crossfade: fade out → skip → fade in
export async function executeCrossfade(): Promise<void> {
  if (isFading) return;
  isFading = true;

  const { crossfadeDuration } = useSettingsStore.getState();
  const fadeOutDuration = (crossfadeDuration * 1000) / 2; // half for fade out
  const fadeInDuration = (crossfadeDuration * 1000) / 2; // half for fade in
  const fadeOutStep = fadeOutDuration / FADE_STEPS;
  const fadeInStep = fadeInDuration / FADE_STEPS;

  try {
    // Fade out
    for (let i = FADE_STEPS; i >= 0; i--) {
      const volume = i / FADE_STEPS;
      await TrackPlayer.setVolume(volume);
      await sleep(fadeOutStep);
    }

    // Skip to next track
    await TrackPlayer.skipToNext();

    // Fade in
    for (let i = 0; i <= FADE_STEPS; i++) {
      const volume = i / FADE_STEPS;
      await TrackPlayer.setVolume(volume);
      await sleep(fadeInStep);
    }
  } catch {
    // Ensure volume is restored on any error
    await TrackPlayer.setVolume(1);
  } finally {
    isFading = false;
  }
}

export function cancelCrossfade() {
  fadeTimers.forEach(clearTimeout);
  fadeTimers = [];
  isFading = false;
  TrackPlayer.setVolume(1);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    fadeTimers.push(timer);
  });
}
