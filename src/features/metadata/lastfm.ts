// Last.fm API client — free with API key.
// Used for similar artists and track recommendations.

const BASE_URL = 'https://ws.audioscrobbler.com/2.0/';

// TODO: Move to env/config. This is a public read-only key.
let apiKey = '';

export function setLastFmApiKey(key: string) {
  apiKey = key;
}

async function lastfmFetch(method: string, params: Record<string, string> = {}) {
  if (!apiKey) throw new Error('Last.fm API key not configured');

  const url = new URL(BASE_URL);
  url.searchParams.set('method', method);
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('format', 'json');
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Last.fm API error: ${response.status}`);
  }
  return response.json();
}

export async function getSimilarArtists(artist: string, limit = 10) {
  const data = await lastfmFetch('artist.getsimilar', {
    artist,
    limit: String(limit),
  });
  return data.similarartists?.artist ?? [];
}

export async function getSimilarTracks(artist: string, track: string, limit = 10) {
  const data = await lastfmFetch('track.getsimilar', {
    artist,
    track,
    limit: String(limit),
  });
  return data.similartracks?.track ?? [];
}

export async function getTopTracks(artist: string, limit = 10) {
  const data = await lastfmFetch('artist.gettoptracks', {
    artist,
    limit: String(limit),
  });
  return data.toptracks?.track ?? [];
}
