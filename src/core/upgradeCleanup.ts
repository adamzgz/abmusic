// Detects stream protocol version changes and clears stale session data.
// YouTube cookies from a previous version can cause VR client rejections
// when request headers change between versions.

import { getDatabase } from '@/core/database/db';

// Bump this when making changes that require clearing YouTube session data.
// This is NOT the app version — it tracks breaking changes in the stream
// resolution logic (headers, client params, PoToken flow, etc.).
const STREAM_PROTOCOL_VERSION = '2';

let _needsCookieClear = false;

// Check if cookies need clearing (called early, before WebView is ready).
export function needsCookieClear(): boolean {
  return _needsCookieClear;
}

// Mark cookie clear as done (called by PoTokenProvider after clearing).
export function markCookiesCleared(): void {
  _needsCookieClear = false;
}

export async function runUpgradeCleanup(): Promise<void> {
  try {
    const db = await getDatabase();

    const row = await db.getFirstAsync<{ value: string }>(
      "SELECT value FROM app_settings WHERE key = 'stream_protocol_version'"
    );

    const storedVersion = row?.value ?? null;

    if (storedVersion === STREAM_PROTOCOL_VERSION) return;

    console.log(
      `[upgrade] Stream protocol changed: ${storedVersion} → ${STREAM_PROTOCOL_VERSION}, clearing session data...`
    );

    // 1. Clear cached stream URLs (may have been fetched with old headers)
    await db.execAsync('DELETE FROM cached_streams');
    console.log('[upgrade] Cleared cached_streams');

    // 2. Signal PoTokenProvider to clear WebView cookies on next load
    _needsCookieClear = true;

    // 3. Save new version
    await db.runAsync(
      "INSERT OR REPLACE INTO app_settings (key, value) VALUES ('stream_protocol_version', ?)",
      STREAM_PROTOCOL_VERSION
    );

    console.log('[upgrade] Cleanup complete');
  } catch (e: any) {
    console.warn('[upgrade] Cleanup failed:', e?.message);
  }
}
