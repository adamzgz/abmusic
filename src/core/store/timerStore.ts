import { create } from 'zustand';

interface TimerState {
  isActive: boolean;
  endsAt: number | null; // timestamp when timer expires
  endOfTrack: boolean; // pause at end of current track instead of timed
  remainingMs: number;

  startTimer: (durationMs: number) => void;
  startEndOfTrack: () => void;
  tick: (now: number) => void;
  cancel: () => void;
}

export const useTimerStore = create<TimerState>((set, get) => ({
  isActive: false,
  endsAt: null,
  endOfTrack: false,
  remainingMs: 0,

  startTimer: (durationMs) =>
    set({
      isActive: true,
      endsAt: Date.now() + durationMs,
      endOfTrack: false,
      remainingMs: durationMs,
    }),

  startEndOfTrack: () =>
    set({
      isActive: true,
      endsAt: null,
      endOfTrack: true,
      remainingMs: 0,
    }),

  tick: (now) => {
    const { endsAt, endOfTrack } = get();
    if (endOfTrack) return; // no countdown for end-of-track mode
    if (!endsAt) return;
    const remaining = Math.max(0, endsAt - now);
    set({ remainingMs: remaining });
  },

  cancel: () =>
    set({
      isActive: false,
      endsAt: null,
      endOfTrack: false,
      remainingMs: 0,
    }),
}));
