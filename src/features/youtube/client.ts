import Innertube, { ClientType } from 'youtubei.js';

// --- Main instance (ANDROID) — for search, browse ---
// retrieve_player: false skips downloading & parsing YouTube's player JS
// (~10+ sec on Hermes). We don't need it because stream URLs are resolved
// via the VR client (WebView with Chrome TLS), not via youtubei.js signatures.
let innertubeInstance: Innertube | null = null;
let initPromise: Promise<Innertube> | null = null;

export async function getInnertube(): Promise<Innertube> {
  if (innertubeInstance) return innertubeInstance;

  if (!initPromise) {
    initPromise = Innertube.create({
      client_type: ClientType.ANDROID,
      retrieve_player: false,
    }).then((instance) => {
      innertubeInstance = instance;
      return instance;
    });
  }

  return initPromise;
}

// Pre-warm Innertube on app startup so first search is instant
export function preWarmInnertube() {
  getInnertube().catch((e) => {
    if (__DEV__) console.warn('[Innertube] pre-warm failed:', e?.message);
  });
}

export function resetInnertube() {
  innertubeInstance = null;
  initPromise = null;
}

// --- Stream client (reuses ANDROID instance) ---
// The ANDROID client generates valid signed URLs.
// The actual HTTP fetch is handled separately (download to temp file).

export async function getStreamClient(): Promise<Innertube> {
  return getInnertube();
}

// Resolve with the stream client. Used by streams.ts
export async function resolveWithFallback<T>(
  fn: (yt: Innertube) => Promise<T>,
): Promise<T> {
  const yt = await getStreamClient();
  return fn(yt);
}

export function resetStreamInnertube() {
  resetInnertube();
}
