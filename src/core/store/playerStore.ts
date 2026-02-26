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

  // Actions
  setQueue: (tracks: MusicTrack[], startIndex?: number) => void;
  addToQueue: (tracks: MusicTrack[]) => void;
  setCurrentIndex: (index: number) => void;
  setRadioMode: (active: boolean) => void;
  setShuffle: (enabled: boolean) => void;
  setRepeatMode: (mode: RepeatMode) => void;
  clearQueue: () => void;
}

export const usePlayerStore = create<PlayerState>((set) => ({
  queue: [],
  currentIndex: 0,
  isRadioMode: false,
  shuffle: false,
  repeatMode: 'off',

  setQueue: (tracks, startIndex = 0) =>
    set({ queue: tracks, currentIndex: startIndex }),

  addToQueue: (tracks) =>
    set((state) => ({ queue: [...state.queue, ...tracks] })),

  setCurrentIndex: (index) => set({ currentIndex: index }),

  setRadioMode: (active) => set({ isRadioMode: active }),

  setShuffle: (enabled) => set({ shuffle: enabled }),

  setRepeatMode: (mode) => set({ repeatMode: mode }),

  clearQueue: () => set({ queue: [], currentIndex: 0, isRadioMode: false }),
}));
