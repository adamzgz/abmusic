# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ABMusic is a YouTube Music streaming app built with Expo SDK 54 + React Native (Hermes engine). It uses youtubei.js for search/browse and an on-device InnerTube VR client (via WebView with Chrome TLS) for stream URL resolution, with react-native-track-player for background audio playback.

**Fully serverless** — no backend or proxy server required.

## Commands

```bash
# Install dependencies (--legacy-peer-deps required due to React 19.1 vs 19.2 peer conflict)
npm install --legacy-peer-deps

# Development (requires dev-client build, not Expo Go)
npx expo start --dev-client

# Android dev build
npx expo run:android

# Android release APK
cd android && ./gradlew assembleRelease
# Output: android/app/build/outputs/apk/release/app-release.apk

# iOS dev build
npx expo run:ios

# TypeScript check
npx tsc --noEmit
```

**No test framework is configured yet.** `postinstall` runs `patch-package` automatically. JDK 17+ required for Gradle builds.

## Architecture

### Entry Point & Polyfills
`index.ts` loads 5 polyfills required by Hermes engine (base-64, URL, TextEncoder, web-streams, EventTarget), registers the TrackPlayer background service, then hands off to expo-router.

### Routing
expo-router with file-based routing from `src/app/`. Four-tab layout: Home, Search, Library, Settings. Additional screens: `player.tsx` (full-screen player modal), `playlist/[id].tsx` (playlist detail).

### Data Flow
```
Search/Browse: youtubei.js (ANDROID client) → MusicTrack → Zustand store → UI
Stream URLs:   InnerTube VR client (WebView, Chrome TLS) → pre-auth googlevideo.com URL → ExoPlayer
Playback:      resolveForPlayback() → TrackPlayer.add({ url }) → ExoPlayer → audio output
```

The logical queue (metadata in Zustand `playerStore`) is separate from the physical player queue (TrackPlayer). This allows managing track metadata independently from what's loaded for playback.

### Stream Resolution (CRITICAL)

**YouTube blocks ALL stream URL fetches from non-browser HTTP clients** via TLS fingerprinting.

Resolution chain:
1. **Offline cache** — check SQLite for cached stream URLs
2. **InnerTube VR** (`src/features/youtube/innertube-vr.ts`) — `android_vr` client via hidden WebView (Chrome TLS). Returns pre-authenticated URLs, no signature deciphering needed.
3. **Piped API** (`src/features/youtube/piped.ts`) — Fallback with instance rotation

**Search/browse:** youtubei.js works fine for metadata (search, getInfo, getArtist, etc.)

**Playback:** Cronet (Chrome's network stack) integrated into ExoPlayer via patch-package (`patches/react-native-track-player+4.1.2.patch`), which inlines KotlinAudio sources and adds Cronet + ExoPlayer 2.19.0.

**PoToken:** `src/features/potoken/` mints tokens via WebView to bypass YouTube's bot protection. `PoTokenProvider.tsx` wraps the app as a singleton.

### Native Modules (`modules/`)

Two Expo native modules (TypeScript → Kotlin):
- **`cronet-download`** — File downloads using Chrome's Cronet network stack
- **`equalizer`** — Android 5-band equalizer (presets: Flat, Bass Boost, Rock, Pop, Vocal)

### Key Patterns

- **Rolling queue:** Only 2 tracks ahead are pre-resolved into TrackPlayer. YouTube stream URLs expire after ~6 hours, so URLs are resolved just-in-time.
- **Innertube singleton:** `features/youtube/client.ts` lazy-initializes one Innertube instance (ANDROID client) with session caching via react-native-mmkv. Used for search/browse only, NOT for stream URLs.
- **Strategy pattern for radio:** `features/radio/engine.ts` accepts any `RadioStrategy` implementation. Four strategies: `artistRadio`, `discoveryRadio`, `genreRadio`, `mixRadio`.
- **Audio format:** Opus in WebM or AAC in M4A, selected by itag. Quality itags: high [251, 140], medium [250, 140], low [249, 250, 140]. **iOS must use AAC [140] only** — AVPlayer doesn't support Opus.
- **Auto-advance workaround:** ExoPlayer with Cronet doesn't reliably emit track-end events. The background service (`features/player/service.ts`) polls playback state every 1.5s to detect "Ended" state, and pre-resolves the next track ~10s before the current one ends. Up to 8 retries on PoToken failures.
- **InnerTube VR rate limit:** 1500ms minimum between stream resolution requests, with 5-hour URL cache.

### State Management
Four Zustand stores in `src/core/store/`:
- `playerStore` — queue, currentIndex, isRadioMode, shuffle, repeatMode, isRestored
- `searchStore` — query, results, suggestions, isLoading, error
- `settingsStore` — audioQuality, crossfadeDuration, eqEnabled, eqPreset, eqBands, lastFmApiKey, themeMode, autoQueue
- `timerStore` — sleep timer (timed duration + end-of-track modes)

### Features (`src/features/`)
- **`player/`** — playTrack orchestration, crossfade (volume ramping), sleep timer, FullPlayer, MiniPlayer, lyrics sync
- **`youtube/`** — innertube-vr (stream URLs), client (search/browse), piped (fallback), search, streams
- **`radio/`** — Engine + 4 strategies + RadioPicker UI
- **`library/`** — Playlist/favorites CRUD, import YouTube playlists
- **`cache/`** — Offline download management (progress, status) + SQLite cache DB
- **`metadata/`** — Lyrics fetching (synced + unsynced), Last.fm API, MusicBrainz
- **`theme/`** — DynamicBackground + useDynamicColors (Material You from album art)
- **`potoken/`** — YouTube bot protection bypass via WebView token minting

### Database
expo-sqlite (WAL mode, foreign keys enabled) with 8 tables in `src/core/database/schema.ts`: playlists, playlist_tracks, favorites, play_history, cached_streams, cached_audio, player_queue, player_state. Queue state is debounce-saved to SQLite and restored on app startup.

### Theme
Material You palette in `src/theme/` with light/dark/system modes (`themeMode` in settingsStore). Primary: `#bb86fc`. Dark background: `#0a0a0a`. Dynamic colors extracted from current track artwork. Typography, spacing, and color scales defined in `src/theme/`.

## Critical Configuration

- `metro.config.js`: `unstable_enablePackageExports: true` — **required** for youtubei.js module resolution
- `app.json`: `expo-router` plugin sets root to `./src/app`; iOS has audio background mode enabled + deploymentTarget 15.1; `newArchEnabled: true`; Android minSdk 24 + `usesCleartextTraffic: true`
- `tsconfig.json`: `@/*` maps to `src/*` for imports; `cronet-download` maps to `modules/cronet-download/src/index`
- `babel.config.js`: `react-native-reanimated/plugin` must be last
- `patches/react-native-track-player+4.1.2.patch`: Inlines KotlinAudio, adds Cronet + ExoPlayer 2.19.0

## Known Issues

- **YouTube 403 on stream URLs:** Solved with WebView (VR client) + Cronet (ExoPlayer).
- `Innertube.create()` can freeze UI for 10+ seconds on first run (CPU-intensive JS parsing in Hermes). Mitigated with `retrieve_player: false` in `features/youtube/client.ts`.
- react-native-track-player requires dev-client builds — **does not work with Expo Go**
- `--legacy-peer-deps` needed for npm install (`.npmrc` has `legacy-peer-deps=true`)

## CI/CD

- `.github/workflows/build-ios.yml` — Manual trigger iOS build (unsigned IPA archive, macOS 15 runner)
