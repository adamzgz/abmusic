import { getDatabase } from '@/core/database/db';
import { searchArtist, getArtist } from '@/features/metadata/musicbrainz';
import { normalizeArtistKey } from './tasteProfile';

const CACHE_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days
const RATE_LIMIT_MS = 1100; // MusicBrainz requires 1 req/s

let lastRequestAt = 0;

async function rateLimitedWait() {
  const elapsed = Date.now() - lastRequestAt;
  if (elapsed < RATE_LIMIT_MS) {
    await new Promise((r) => setTimeout(r, RATE_LIMIT_MS - elapsed));
  }
  lastRequestAt = Date.now();
}

// Get genres for an artist, checking cache first.
export async function getArtistGenres(artistName: string): Promise<string[]> {
  const db = await getDatabase();
  const key = normalizeArtistKey(artistName);

  // Check cache
  const cached = await db.getFirstAsync<{ genres: string; fetched_at: number }>(
    'SELECT genres, fetched_at FROM genre_cache WHERE artist_key = ?',
    key
  );

  if (cached && Date.now() - cached.fetched_at < CACHE_TTL) {
    try {
      return JSON.parse(cached.genres);
    } catch {
      // Corrupted cache — re-fetch
    }
  }

  // Fetch from MusicBrainz
  try {
    await rateLimitedWait();
    const searchResult = await searchArtist(artistName);
    const artists = searchResult?.artists;
    if (!artists || artists.length === 0) {
      await cacheGenres(db, key, []);
      return [];
    }

    const mbid = artists[0].id;
    await rateLimitedWait();
    const artistData = await getArtist(mbid);
    const genres: string[] = (artistData?.genres ?? [])
      .map((g: { name: string }) => g.name)
      .filter(Boolean);

    await cacheGenres(db, key, genres);
    return genres;
  } catch (err) {
    if (__DEV__) console.warn('[genreResolver] Failed for', artistName, err);
    return [];
  }
}

async function cacheGenres(
  db: Awaited<ReturnType<typeof getDatabase>>,
  key: string,
  genres: string[]
) {
  await db.runAsync(
    `INSERT INTO genre_cache (artist_key, genres, fetched_at)
     VALUES (?, ?, ?)
     ON CONFLICT(artist_key) DO UPDATE SET genres = ?, fetched_at = ?`,
    key,
    JSON.stringify(genres),
    Date.now(),
    JSON.stringify(genres),
    Date.now()
  );
}

// Resolve genres for multiple artists (lazy, best-effort).
export async function resolveGenresForTopArtists(
  artists: { artistName: string }[]
): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>();
  for (const a of artists.slice(0, 20)) {
    const genres = await getArtistGenres(a.artistName);
    if (genres.length > 0) {
      result.set(normalizeArtistKey(a.artistName), genres);
    }
  }
  return result;
}
