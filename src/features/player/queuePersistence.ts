import { getDatabase } from '@/core/database/db';
import type { MusicTrack } from '@/features/youtube/types';

// Save the current queue and player state to SQLite.
// Called with debounce whenever the queue changes.
export async function saveQueue(
  queue: MusicTrack[],
  currentIndex: number,
  shuffle: boolean,
  repeatMode: string,
) {
  const db = await getDatabase();

  await db.withExclusiveTransactionAsync(async (tx) => {
    // Clear old queue
    await tx.runAsync('DELETE FROM player_queue');
    await tx.runAsync('DELETE FROM player_state');

    // Insert tracks
    for (let i = 0; i < queue.length; i++) {
      const t = queue[i];
      await tx.runAsync(
        `INSERT INTO player_queue (position, track_id, title, artist, artist_id, album, duration, thumbnail)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        i,
        t.id,
        t.title,
        t.artist,
        t.artistId ?? null,
        t.album ?? null,
        t.duration ?? 0,
        t.thumbnail ?? null,
      );
    }

    // Save state
    await tx.runAsync(
      `INSERT INTO player_state (key, value) VALUES ('currentIndex', ?)`,
      String(currentIndex),
    );
    await tx.runAsync(
      `INSERT INTO player_state (key, value) VALUES ('shuffle', ?)`,
      String(shuffle),
    );
    await tx.runAsync(
      `INSERT INTO player_state (key, value) VALUES ('repeatMode', ?)`,
      repeatMode,
    );
  });
}

// Restore queue and state from SQLite. Returns null if nothing saved.
export async function restoreQueue(): Promise<{
  queue: MusicTrack[];
  currentIndex: number;
  shuffle: boolean;
  repeatMode: 'off' | 'all' | 'one';
} | null> {
  const db = await getDatabase();

  const rows = await db.getAllAsync<{
    position: number;
    track_id: string;
    title: string;
    artist: string;
    artist_id: string | null;
    album: string | null;
    duration: number;
    thumbnail: string | null;
  }>('SELECT * FROM player_queue ORDER BY position ASC');

  if (rows.length === 0) return null;

  const queue: MusicTrack[] = rows.map((r) => ({
    id: r.track_id,
    title: r.title,
    artist: r.artist,
    artistId: r.artist_id ?? undefined,
    album: r.album ?? undefined,
    duration: r.duration,
    thumbnail: r.thumbnail || '',
  }));

  // Read state values
  const stateRows = await db.getAllAsync<{ key: string; value: string }>(
    'SELECT key, value FROM player_state',
  );
  const state: Record<string, string> = {};
  for (const row of stateRows) {
    state[row.key] = row.value;
  }

  return {
    queue,
    currentIndex: parseInt(state.currentIndex ?? '0', 10),
    shuffle: state.shuffle === 'true',
    repeatMode: (state.repeatMode ?? 'off') as 'off' | 'all' | 'one',
  };
}
