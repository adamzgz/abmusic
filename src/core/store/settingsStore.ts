import { create } from 'zustand';
import { getDatabase } from '@/core/database/db';
import type { AudioQuality } from '@/features/youtube/types';

export type ThemeMode = 'light' | 'dark' | 'system';

interface SettingsState {
  audioQuality: AudioQuality;
  crossfadeDuration: number; // seconds (0 = off, max 12)
  eqEnabled: boolean;
  eqPreset: string; // preset name
  eqBands: number[]; // millibel levels per band
  lastFmApiKey: string;
  themeMode: ThemeMode;
  autoQueue: boolean;
  _hydrated: boolean;

  setAudioQuality: (quality: AudioQuality) => void;
  setCrossfadeDuration: (seconds: number) => void;
  setEqEnabled: (enabled: boolean) => void;
  setEqPreset: (name: string, bands: readonly number[]) => void;
  setEqBands: (bands: number[]) => void;
  setLastFmApiKey: (key: string) => void;
  setThemeMode: (mode: ThemeMode) => void;
  setAutoQueue: (enabled: boolean) => void;
  hydrate: () => Promise<void>;
}

// Keys that get persisted to SQLite
const PERSISTED_KEYS = [
  'audioQuality',
  'crossfadeDuration',
  'eqEnabled',
  'eqPreset',
  'eqBands',
  'lastFmApiKey',
  'themeMode',
  'autoQueue',
] as const;

// Save a single setting to SQLite (fire-and-forget)
function saveSetting(key: string, value: unknown) {
  getDatabase().then((db) =>
    db.runAsync(
      'INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)',
      key,
      JSON.stringify(value),
    ),
  ).catch((err) => console.warn('[settings] Failed to save', key, err));
}

export const useSettingsStore = create<SettingsState>((set) => ({
  audioQuality: 'high',
  crossfadeDuration: 0,
  eqEnabled: false,
  eqPreset: 'Flat',
  eqBands: [0, 0, 0, 0, 0],
  lastFmApiKey: '',
  themeMode: 'dark',
  autoQueue: true,
  _hydrated: false,

  setAudioQuality: (audioQuality) => {
    set({ audioQuality });
    saveSetting('audioQuality', audioQuality);
  },
  setCrossfadeDuration: (crossfadeDuration) => {
    const clamped = Math.max(0, Math.min(12, crossfadeDuration));
    set({ crossfadeDuration: clamped });
    saveSetting('crossfadeDuration', clamped);
  },
  setEqEnabled: (eqEnabled) => {
    set({ eqEnabled });
    saveSetting('eqEnabled', eqEnabled);
  },
  setEqPreset: (name, bands) => {
    const bandsCopy = [...bands];
    set({ eqPreset: name, eqBands: bandsCopy });
    saveSetting('eqPreset', name);
    saveSetting('eqBands', bandsCopy);
  },
  setEqBands: (eqBands) => {
    set({ eqBands, eqPreset: 'Custom' });
    saveSetting('eqBands', eqBands);
    saveSetting('eqPreset', 'Custom');
  },
  setLastFmApiKey: (lastFmApiKey) => {
    set({ lastFmApiKey });
    saveSetting('lastFmApiKey', lastFmApiKey);
  },
  setThemeMode: (themeMode) => {
    set({ themeMode });
    saveSetting('themeMode', themeMode);
  },
  setAutoQueue: (autoQueue) => {
    set({ autoQueue });
    saveSetting('autoQueue', autoQueue);
  },

  hydrate: async () => {
    try {
      const db = await getDatabase();
      const rows = await db.getAllAsync<{ key: string; value: string }>(
        'SELECT key, value FROM app_settings',
      );

      const restored: Record<string, unknown> = {};
      for (const row of rows) {
        try {
          restored[row.key] = JSON.parse(row.value);
        } catch {
          // skip malformed values
        }
      }

      set({
        ...(restored.audioQuality != null && { audioQuality: restored.audioQuality as AudioQuality }),
        ...(restored.crossfadeDuration != null && { crossfadeDuration: restored.crossfadeDuration as number }),
        ...(restored.eqEnabled != null && { eqEnabled: restored.eqEnabled as boolean }),
        ...(restored.eqPreset != null && { eqPreset: restored.eqPreset as string }),
        ...(restored.eqBands != null && { eqBands: restored.eqBands as number[] }),
        ...(restored.lastFmApiKey != null && { lastFmApiKey: restored.lastFmApiKey as string }),
        ...(restored.themeMode != null && { themeMode: restored.themeMode as ThemeMode }),
        ...(restored.autoQueue != null && { autoQueue: restored.autoQueue as boolean }),
        _hydrated: true,
      });

      console.log('[settings] Hydrated from SQLite', Object.keys(restored).length, 'keys');
    } catch (err) {
      console.warn('[settings] Hydration failed', err);
      set({ _hydrated: true });
    }
  },
}));
