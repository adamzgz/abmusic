# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SonicFlow is a YouTube Music streaming app built with Expo SDK 54 + React Native (Hermes engine). It uses youtubei.js for search/browse and a local yt-dlp proxy server for stream URL resolution, with react-native-track-player for background audio playback.

**Current status:** Phase 2 (MVP) in progress. Core playback pipeline working (search → stream resolution → audio playback → MiniPlayer).

## Commands

```bash
# Development (requires dev-client build, not Expo Go)
cd sonicflow && npx expo start --dev-client

# Android dev build
cd sonicflow && npx expo run:android

# iOS dev build
cd sonicflow && npx expo run:ios

# Stream server (REQUIRED for audio playback in dev)
cd sonicflow && python stream-server.py
# Runs on port 3333. Emulator connects via http://10.0.2.2:3333
# Requires: pip install yt-dlp

# Install dependencies (--legacy-peer-deps required due to React 19.1 vs 19.2 peer conflict)
cd sonicflow && npm install --legacy-peer-deps

# TypeScript check
cd sonicflow && npx tsc --noEmit
```

**No test framework is configured yet.**

## Architecture

### Entry Point & Polyfills
`index.ts` loads 5 polyfills required by Hermes engine (base-64, URL, TextEncoder, web-streams, EventTarget), registers the TrackPlayer background service, then hands off to expo-router.

### Routing
expo-router with file-based routing from `src/app/`. Three-tab layout: Home, Search, Library. All screens are currently placeholders.

### Data Flow
```
Search/Browse: youtubei.js (ANDROID client) → MusicTrack → Zustand store → UI
Stream URLs:   App → stream-server.py (yt-dlp on host) → googlevideo.com URL → ExoPlayer
Playback:      resolveForPlayback() → TrackPlayer.add({ url }) → ExoPlayer → audio output
```

The logical queue (metadata in Zustand `playerStore`) is separate from the physical player queue (TrackPlayer). This allows managing track metadata independently from what's loaded for playback.

### Stream Resolution (CRITICAL)

**YouTube blocks ALL stream URL fetches from non-browser HTTP clients.** This was the #1 blocker during development. See RESEARCH.md §9 for the full investigation.

Current architecture:
- **Search/browse:** youtubei.js works fine for metadata (search, getInfo, getArtist, etc.)
- **Stream URLs:** Resolved via a local proxy server (`stream-server.py`) that runs yt-dlp on the host machine
- **Why:** YouTube's CDN rejects requests from OkHttp/ExoPlayer/RN fetch with HTTP 403, regardless of headers, PO tokens, or client type
- **Dev flow:** Emulator connects to host via `http://10.0.2.2:3333/stream/{videoId}`
- **TODO:** Production needs a cloud proxy or on-device alternative

Key files:
- `stream-server.py` — Python HTTP server wrapping yt-dlp (runs on host)
- `src/features/youtube/android-vr-client.ts` — Client that calls the proxy
- `src/features/player/playTrack.ts` — Orchestrates: offline cache → proxy → TrackPlayer

### Key Patterns

- **Rolling queue:** Only 2 tracks ahead are pre-resolved into TrackPlayer. YouTube stream URLs expire after ~6 hours, so URLs are resolved just-in-time via the proxy server.
- **Innertube singleton:** `features/youtube/client.ts` lazy-initializes one Innertube instance (ANDROID client) with session caching via react-native-mmkv. Used for search/browse only, NOT for stream URLs.
- **Rate limiting:** `playTrack.ts` enforces 1.5s minimum gap between stream requests to avoid hitting yt-dlp too fast.
- **Strategy pattern for radio:** `features/radio/engine.ts` accepts any `RadioStrategy` implementation. First strategy is `artistRadio` using YouTube's Up Next.
- **Audio format:** yt-dlp selects `bestaudio[ext=m4a]/bestaudio` — typically AAC in M4A container.

### State Management
Three Zustand stores in `src/core/store/`:
- `playerStore` — queue, currentIndex, radio mode
- `searchStore` — query, results, suggestions, loading state
- `settingsStore` — audio quality preference (high/medium/low)

### Database
expo-sqlite with 5 tables defined in `src/core/database/schema.ts`: playlists, playlist_tracks, favorites, play_history, cached_streams. Library functions in `features/library/` are stubbed (TODO).

### Theme
Dark-only Material You palette in `src/theme/`. Primary: `#bb86fc`. Background: `#0a0a0a`.

## Critical Configuration

- `metro.config.js`: `unstable_enablePackageExports: true` — **required** for youtubei.js module resolution
- `app.json`: `expo-router` plugin sets root to `./src/app`; iOS has audio background mode enabled
- `tsconfig.json`: `@/*` maps to `src/*` for imports
- `babel.config.js`: `react-native-reanimated/plugin` must be last

## Known Issues

- **YouTube 403 on stream URLs:** YouTube CDN blocks all stream URL requests from OkHttp/ExoPlayer via TLS fingerprinting. This is why we use the yt-dlp proxy server. See RESEARCH.md §9.
- **Pre-resolve JSON parse error:** Occasionally yt-dlp returns an incomplete response for some videos, causing "JSON Parse error: Unexpected end of input" during pre-resolve of next tracks. Non-blocking — current track plays fine.
- `Innertube.create()` can freeze UI for 10+ seconds on first run (CPU-intensive JS parsing in Hermes)
- react-native-track-player requires dev-client builds — **does not work with Expo Go**
- `--legacy-peer-deps` needed for npm install
- `stream-server.py` must be running on host for audio playback during development

## Project Spec & Research

- `CLAUDE_CODE_PROMPT.md` — Full project requirements (Phases 0-3)
- `RESEARCH.md` — Technical research findings (includes §9: YouTube stream blocking investigation)
