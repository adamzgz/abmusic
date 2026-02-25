import { requireNativeModule } from 'expo-modules-core';

interface EqualizerNativeModule {
  initialize(audioSessionId: number): boolean;
  setEnabled(enabled: boolean): void;
  getNumberOfBands(): number;
  getBandLevelRange(): [number, number];
  getCenterFreq(band: number): number;
  getBandLevel(band: number): number;
  setBandLevel(band: number, level: number): void;
  getNumberOfPresets(): number;
  getPresetName(preset: number): string;
  usePreset(preset: number): void;
  release(): void;
}

let nativeModule: EqualizerNativeModule | null = null;

function getModule(): EqualizerNativeModule {
  if (!nativeModule) {
    nativeModule = requireNativeModule<EqualizerNativeModule>('Equalizer');
  }
  return nativeModule;
}

export interface EqBandInfo {
  band: number;
  centerFreq: number; // Hz
  label: string; // e.g. "60Hz", "3.6kHz"
  level: number; // millibels
}

export interface EqPreset {
  index: number;
  name: string;
}

// Built-in presets that we expose to the UI
export const APP_PRESETS = [
  { name: 'Flat', bands: [0, 0, 0, 0, 0] },
  { name: 'Bass Boost', bands: [600, 400, 0, 0, 0] },
  { name: 'Rock', bands: [400, 200, -100, 200, 400] },
  { name: 'Pop', bands: [-100, 200, 400, 200, -100] },
  { name: 'Vocal', bands: [-200, 0, 300, 200, 100] },
] as const;

export function initialize(audioSessionId: number): boolean {
  return getModule().initialize(audioSessionId);
}

export function setEnabled(enabled: boolean): void {
  getModule().setEnabled(enabled);
}

export function getBands(): EqBandInfo[] {
  const mod = getModule();
  const count = mod.getNumberOfBands();
  const bands: EqBandInfo[] = [];

  for (let i = 0; i < count; i++) {
    const freqMilliHz = mod.getCenterFreq(i);
    const freqHz = freqMilliHz / 1000;
    bands.push({
      band: i,
      centerFreq: freqHz,
      label: formatFreq(freqHz),
      level: mod.getBandLevel(i),
    });
  }

  return bands;
}

export function getBandLevelRange(): [number, number] {
  return getModule().getBandLevelRange();
}

export function setBandLevel(band: number, level: number): void {
  getModule().setBandLevel(band, level);
}

export function applyPreset(bands: readonly number[]): void {
  const mod = getModule();
  const count = mod.getNumberOfBands();
  for (let i = 0; i < Math.min(bands.length, count); i++) {
    mod.setBandLevel(i, bands[i]);
  }
}

export function release(): void {
  getModule().release();
}

function formatFreq(hz: number): string {
  if (hz >= 1000) return `${(hz / 1000).toFixed(1).replace('.0', '')}kHz`;
  return `${Math.round(hz)}Hz`;
}
