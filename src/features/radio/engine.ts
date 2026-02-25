import type { MusicTrack } from '../youtube/types';
import type { RadioStrategy, RadioState } from './types';

// Radio engine — manages the active radio mode and fetches more tracks
// when the queue runs low. Strategy pattern allows different radio modes.

let activeStrategy: RadioStrategy | null = null;
let currentSeed: string | null = null;

export function getRadioState(): RadioState {
  return {
    isActive: activeStrategy !== null,
    strategyName: activeStrategy?.name ?? null,
    seed: currentSeed,
  };
}

export function startRadio(strategy: RadioStrategy, seed: string) {
  activeStrategy = strategy;
  currentSeed = seed;
}

export function stopRadio() {
  activeStrategy = null;
  currentSeed = null;
}

export async function getMoreRadioTracks(): Promise<MusicTrack[]> {
  if (!activeStrategy || !currentSeed) return [];
  return activeStrategy.generateTracks(currentSeed);
}
