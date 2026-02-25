import Innertube, { ClientType, Platform } from 'youtubei.js';

// Hermes eval shim for sig + n transforms
Platform.shim.eval = async (
  data: any,
  env: { sig?: string; n?: string }
): Promise<{ sig?: string; n?: string }> => {
  if (__DEV__) {
    console.log('[hermesEval] called, env:', JSON.stringify(Object.keys(env || {})));
    console.log('[hermesEval] data.output length:', data?.output?.length);
  }
  try {
    const exportedVars: any = eval(
      `(function() { ${data.output}; return exportedVars; })()`
    );
    if (__DEV__) {
      console.log('[hermesEval] exportedVars type:', typeof exportedVars,
        'sigFn:', typeof exportedVars?.sigFunction,
        'nFn:', typeof exportedVars?.nFunction);
    }
    const result: { sig?: string; n?: string } = {};
    if (env.sig != null && typeof exportedVars?.sigFunction === 'function') {
      result.sig = exportedVars.sigFunction(env.sig);
    }
    if (env.n != null && typeof exportedVars?.nFunction === 'function') {
      result.n = exportedVars.nFunction(env.n);
      if (__DEV__ && result.n === env.n) {
        console.error('[hermesEval] WARNING: n-transform returned same value!');
      }
    }
    if (__DEV__) console.log('[hermesEval] result:', JSON.stringify(result));
    return result;
  } catch (e: any) {
    console.error('[hermesEval] ERROR:', e?.message ?? e);
    throw e;
  }
};

// --- Main instance (ANDROID) — for search, browse ---
let innertubeInstance: Innertube | null = null;
let initPromise: Promise<Innertube> | null = null;

export async function getInnertube(): Promise<Innertube> {
  if (innertubeInstance) return innertubeInstance;

  if (!initPromise) {
    initPromise = Innertube.create({
      client_type: ClientType.ANDROID,
    }).then((instance) => {
      innertubeInstance = instance;
      return instance;
    });
  }

  return initPromise;
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
