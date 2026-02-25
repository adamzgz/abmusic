// MusicBrainz API client — free, no auth required.
// Used for enriching artist/album/genre metadata.
// Rate limit: 1 request per second (be respectful).

const BASE_URL = 'https://musicbrainz.org/ws/2';
const USER_AGENT = 'SonicFlow/1.0.0 (https://github.com/adamzgz/sonicflow)';

async function mbFetch(endpoint: string, params: Record<string, string> = {}) {
  const url = new URL(`${BASE_URL}/${endpoint}`);
  url.searchParams.set('fmt', 'json');
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url.toString(), {
    headers: { 'User-Agent': USER_AGENT },
  });

  if (!response.ok) {
    throw new Error(`MusicBrainz API error: ${response.status}`);
  }

  return response.json();
}

export async function searchArtist(name: string) {
  return mbFetch('artist', { query: name, limit: '5' });
}

export async function getArtist(mbid: string) {
  return mbFetch(`artist/${mbid}`, { inc: 'genres' });
}

export async function searchRelease(title: string, artist?: string) {
  const query = artist ? `${title} AND artist:${artist}` : title;
  return mbFetch('release', { query, limit: '5' });
}
