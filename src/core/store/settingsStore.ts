import { create } from 'zustand';
import type { AudioQuality } from '@/features/youtube/types';

interface SettingsState {
  audioQuality: AudioQuality;
  crossfadeDuration: number; // seconds (0 = off, max 12)
  eqEnabled: boolean;
  eqPreset: string; // preset name
  eqBands: number[]; // millibel levels per band
  lastFmApiKey: string;

  setAudioQuality: (quality: AudioQuality) => void;
  setCrossfadeDuration: (seconds: number) => void;
  setEqEnabled: (enabled: boolean) => void;
  setEqPreset: (name: string, bands: readonly number[]) => void;
  setEqBands: (bands: number[]) => void;
  setLastFmApiKey: (key: string) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  audioQuality: 'high',
  crossfadeDuration: 0,
  eqEnabled: false,
  eqPreset: 'Flat',
  eqBands: [0, 0, 0, 0, 0],
  lastFmApiKey: '',

  setAudioQuality: (audioQuality) => set({ audioQuality }),
  setCrossfadeDuration: (crossfadeDuration) =>
    set({ crossfadeDuration: Math.max(0, Math.min(12, crossfadeDuration)) }),
  setEqEnabled: (eqEnabled) => set({ eqEnabled }),
  setEqPreset: (name, bands) => set({ eqPreset: name, eqBands: [...bands] }),
  setEqBands: (eqBands) => set({ eqBands, eqPreset: 'Custom' }),
  setLastFmApiKey: (lastFmApiKey) => set({ lastFmApiKey }),
}));
