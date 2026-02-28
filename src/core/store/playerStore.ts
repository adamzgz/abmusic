import { create } from 'zustand';
import type { MusicTrack } from '@/features/youtube/types';

type RepeatMode = 'off' | 'all' | 'one';

interface PlayerState {
  // Current logical queue (track metadata, not stream URLs)
  queue: MusicTrack[];
  currentIndex: number;
  isRadioMode: boolean;
  shuffle: boolean;
  repeatMode: RepeatMode;
  isRestored: boolean;

  // Actions
  setQueue: (tracks: MusicTrack[], startIndex?: number) => void;
  addToQueue: (tracks: MusicTrack[]) => void;
  setCurrentIndex: (index: number) => void;
  setRadioMode: (active: boolean) => void;
  setShuffle: (enabled: boolean) => void;
  setRepeatMode: (mode: RepeatMode) => void;
  clearQueue: () => void;
  restoreFromDb: () => Promise<void>;
}

// Debounced save — avoids hammering SQLite on rapid queue changes
let saveTimer: ReturnType<typeof setTimeout> | null = null;
function debouncedSave(state: PlayerState) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      const { saveQueue } = await import(
        '@/features/player/queuePersistence'
      );
      await saveQueue(
        state.queue,
        state.currentIndex,
        state.shuffle,
        state.repeatMode,
      );
    } catch (e) {
      if (__DEV__) console.warn('[playerStore] save failed:', e);
    }
  }, 1000);
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  queue: [],
  currentIndex: 0,
  isRadioMode: false,
  shuffle: false,
  repeatMode: 'off',
  isRestored: false,

  setQueue: (tracks, startIndex = 0) => {
    set({ queue: tracks, currentIndex: startIndex });
    debouncedSave(get());
  },

  addToQueue: (tracks) => {
    set((state) => ({ queue: [...state.queue, ...tracks] }));
    debouncedSave(get());
  },

  setCurrentIndex: (index) => {
    set({ currentIndex: index });
    debouncedSave(get());
  },

  setRadioMode: (active) => set({ isRadioMode: active }),

  setShuffle: (enabled) => {
    set({ shuffle: enabled });
    debouncedSave(get());
  },

  setRepeatMode: (mode) => {
    set({ repeatMode: mode });
    debouncedSave(get());
  },

  clearQueue: () => {
    set({ queue: [], currentIndex: 0, isRadioMode: false });
    debouncedSave(get());
  },

  restoreFromDb: async () => {
    try {
      const { restoreQueue } = await import(
        '@/features/player/queuePersistence'
      );
      const saved = await restoreQueue();
      if (saved) {
        set({
          queue: saved.queue,
          currentIndex: saved.currentIndex,
          shuffle: saved.shuffle,
          repeatMode: saved.repeatMode,
          isRestored: true,
        });
        if (__DEV__)
          console.log(
            '[playerStore] Restored queue:',
            saved.queue.length,
            'tracks, index:',
            saved.currentIndex,
          );
      } else {
        set({ isRestored: true });
      }
    } catch (e) {
      if (__DEV__) console.warn('[playerStore] restore failed:', e);
      set({ isRestored: true });
    }
  },
}));
