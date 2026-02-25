// LRCLib API client — free, no auth, ~3M synced lyrics.
// Returns time-synced lyrics in LRC format.

const BASE_URL = 'https://lrclib.net/api';

export interface SyncedLyric {
  time: number; // seconds
  text: string;
}

export interface LyricsResult {
  plain: string;
  synced: SyncedLyric[];
  hasSynced: boolean;
}

export async function getLyrics(
  title: string,
  artist: string,
  duration?: number
): Promise<LyricsResult | null> {
  const params = new URLSearchParams({
    track_name: title,
    artist_name: artist,
  });
  if (duration) {
    params.set('duration', String(Math.round(duration)));
  }

  const response = await fetch(`${BASE_URL}/get?${params}`);
  if (!response.ok) return null;

  const data = await response.json();

  const synced = data.syncedLyrics ? parseLRC(data.syncedLyrics) : [];

  return {
    plain: data.plainLyrics ?? '',
    synced,
    hasSynced: synced.length > 0,
  };
}

// Parse LRC format: [mm:ss.xx] lyrics text
function parseLRC(lrc: string): SyncedLyric[] {
  const lines = lrc.split('\n');
  const result: SyncedLyric[] = [];

  for (const line of lines) {
    const match = line.match(/^\[(\d{2}):(\d{2})\.(\d{2,3})\]\s*(.*)$/);
    if (match) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const centis = parseInt(match[3], 10);
      const time = minutes * 60 + seconds + centis / (match[3].length === 3 ? 1000 : 100);
      result.push({ time, text: match[4] });
    }
  }

  return result;
}
