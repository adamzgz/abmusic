import { useEffect, useState, useMemo } from 'react';
import { useProgress } from 'react-native-track-player';
import { getLyrics, type LyricsResult, type SyncedLyric } from '@/features/metadata/lyrics';

interface UseLyricsReturn {
  lyrics: LyricsResult | null;
  activeLine: number; // index of the currently active synced line
  isLoading: boolean;
  error: boolean;
}

export function useLyrics(
  title: string | undefined,
  artist: string | undefined,
  duration: number | undefined
): UseLyricsReturn {
  const [lyrics, setLyrics] = useState<LyricsResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);
  const progress = useProgress(200); // update every 200ms for smoother sync

  // Fetch lyrics when track changes
  useEffect(() => {
    if (!title || !artist) {
      setLyrics(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(false);

    getLyrics(title, artist, duration)
      .then((result) => {
        if (!cancelled) setLyrics(result);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [title, artist, duration]);

  // Binary search for the active line based on current position
  const activeLine = useMemo(() => {
    if (!lyrics?.hasSynced || lyrics.synced.length === 0) return -1;
    return findActiveLine(lyrics.synced, progress.position);
  }, [lyrics, progress.position]);

  return { lyrics, activeLine, isLoading, error };
}

function findActiveLine(lines: SyncedLyric[], position: number): number {
  let lo = 0;
  let hi = lines.length - 1;
  let result = -1;

  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    if (lines[mid].time <= position) {
      result = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  return result;
}
