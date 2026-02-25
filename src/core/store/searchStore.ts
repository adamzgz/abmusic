import { create } from 'zustand';
import type { MusicTrack } from '@/features/youtube/types';

interface SearchState {
  query: string;
  results: MusicTrack[];
  suggestions: string[];
  isLoading: boolean;
  error: string | null;

  setQuery: (query: string) => void;
  setResults: (results: MusicTrack[]) => void;
  setSuggestions: (suggestions: string[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clear: () => void;
}

export const useSearchStore = create<SearchState>((set) => ({
  query: '',
  results: [],
  suggestions: [],
  isLoading: false,
  error: null,

  setQuery: (query) => set({ query }),
  setResults: (results) => set({ results, error: null }),
  setSuggestions: (suggestions) => set({ suggestions }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error, isLoading: false }),
  clear: () => set({ query: '', results: [], suggestions: [], error: null }),
}));
