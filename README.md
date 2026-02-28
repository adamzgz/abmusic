# ABMusic

A fully serverless music streaming client for Android & iOS, built as a technical challenge to explore YouTube's InnerTube API, native module development, and real-time audio streaming — all without any backend infrastructure.

## Why This Project

Modern streaming platforms rely on complex server-side architectures for stream resolution, authentication, and content delivery. **ABMusic removes the server entirely**, pushing all that logic to the client. This creates interesting engineering problems:

- How do you resolve stream URLs when CDNs actively block non-browser clients?
- How do you manage ephemeral URLs (6-hour TTL) in a background audio player?
- How do you maintain a smooth UX when every track requires on-demand resolution?

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Expo SDK 54 + React Native (Hermes) |
| Routing | expo-router (file-based, 4-tab layout) |
| State | Zustand (4 stores) + expo-sqlite (WAL mode) |
| Audio | react-native-track-player + ExoPlayer 2.19.0 |
| Network | Cronet (Chrome's network stack) via custom native module |
| Metadata | youtubei.js (InnerTube ANDROID client) |
| Streams | InnerTube VR client via WebView (Chrome TLS fingerprint) |
| UI | React Native Reanimated + Material You dynamic theming |

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Expo Router                       │
│         Home  │  Search  │  Library  │  Settings     │
├─────────────────────────────────────────────────────┤
│                   Feature Layer                      │
│  Player │ YouTube │ Radio │ Library │ Cache │ Theme  │
├─────────────────────────────────────────────────────┤
│                    Core Layer                        │
│     Zustand Stores  │  SQLite DB  │  Utilities       │
├─────────────────────────────────────────────────────┤
│                 Native Modules                       │
│         Cronet Download  │  5-Band Equalizer         │
├─────────────────────────────────────────────────────┤
│              React Native + Hermes                   │
└─────────────────────────────────────────────────────┘
```

### Stream Resolution Chain

YouTube actively blocks stream URL fetches from non-browser HTTP clients via TLS fingerprinting. The resolution strategy uses a 3-tier fallback:

1. **SQLite cache** — check for cached URLs (5-hour TTL)
2. **InnerTube VR client** — `android_vr` client running inside a hidden WebView to match Chrome's TLS fingerprint. Returns pre-authenticated URLs with no signature deciphering needed.
3. **Piped API fallback** — instance rotation across public Piped servers

### Dual Queue Architecture

The player maintains two separate queues:

- **Logical queue** (Zustand) — full track metadata, user-facing, supports shuffle/repeat/radio
- **Physical queue** (TrackPlayer/ExoPlayer) — only ~2 tracks ahead, resolved just-in-time

This separation exists because stream URLs expire. Pre-resolving an entire playlist would mean broken URLs by the time you reach track 5. Instead, tracks are resolved on-demand with a rolling window.

### Auto-Advance Workaround

ExoPlayer with Cronet doesn't reliably emit `PlaybackQueueEnded` events. The background service implements:

- Polling playback state every 1.5s to detect track end
- Pre-resolving the next track ~10s before the current one ends
- Up to 8 retries on token failures with exponential backoff

## Native Modules

### Cronet Download (`modules/cronet-download`)

Custom Expo native module (TypeScript → Kotlin/Swift) that wraps Chrome's Cronet network stack for file downloads. Provides chunked range requests with progress events, necessary because standard HTTP clients get blocked by YouTube's CDN.

### Equalizer (`modules/equalizer`)

5-band audio equalizer using Android's native `Equalizer` API and iOS `AVAudioEngine`. Includes presets (Flat, Bass Boost, Rock, Pop, Vocal) with per-band control.

## Key Technical Decisions

| Decision | Rationale |
|----------|-----------|
| **WebView for stream URLs** | YouTube's TLS fingerprinting blocks all non-browser clients. A hidden WebView provides a real Chrome TLS stack. |
| **Cronet in ExoPlayer** | Standard OkHttp gets 403'd by YouTube CDN. Cronet (Chrome's network stack) passes fingerprint checks. Integrated via patch-package. |
| **Zustand over Redux** | Simpler API for 4 independent stores. No boilerplate, direct mutations, built-in subscriptions. |
| **SQLite over AsyncStorage** | Relational data (playlists, history, engagement tracking) + WAL mode for concurrent reads during playback. |
| **Strategy pattern for radio** | 4 radio modes (artist, discovery, genre, mix) share a common engine. Adding new modes requires zero changes to the player. |
| **Hermes polyfills** | Hermes lacks `URL`, `TextEncoder`, `ReadableStream`, `EventTarget`. Five polyfills loaded at entry point before any library code. |

## Features

- **Search & Browse** — tracks, albums, artists via InnerTube API
- **Background Playback** — full background audio with lock screen controls
- **Smart Radio** — 4 strategy-based radio modes (artist, discovery, genre, mix)
- **Offline Cache** — download tracks for offline playback via Cronet
- **Synced Lyrics** — real-time lyrics synced to playback position
- **Dynamic Theming** — Material You palette extracted from album artwork
- **Sleep Timer** — timed duration or end-of-track modes
- **Playlist Management** — create, import from YouTube, favorites, play history
- **Personalized Recommendations** — taste profiling based on play/skip engagement data
- **Crossfade** — volume ramping between tracks
- **Audio Quality Selection** — Opus/WebM or AAC/M4A with configurable quality tiers

## Project Structure

```
src/
├── app/                  # expo-router screens (Home, Search, Library, Settings, Player)
├── components/           # Reusable UI (TrackItem, QueueView, PlaylistCard, etc.)
├── core/
│   ├── store/            # 4 Zustand stores (player, search, settings, timer)
│   ├── database/         # SQLite schema, migrations, queries
│   └── utils/            # Formatting, network, thumbnails
├── features/
│   ├── player/           # Playback orchestration, background service, crossfade, lyrics
│   ├── youtube/          # InnerTube clients, search, stream resolution, Piped fallback
│   ├── radio/            # Engine + 4 radio strategies
│   ├── library/          # Playlists, favorites, history, YouTube import
│   ├── cache/            # Offline download management
│   ├── metadata/         # Lyrics, Last.fm, MusicBrainz
│   ├── theme/            # Dynamic background, Material You colors
│   ├── potoken/          # Bot protection token minting via WebView
│   └── recommendation/   # Smart autoplay, taste profiling, engagement tracking
├── theme/                # Design system (colors, typography, spacing)
modules/
├── cronet-download/      # Native module: Chrome network stack for downloads
└── equalizer/            # Native module: 5-band EQ (Android + iOS)
```

## Database

SQLite with WAL mode and foreign keys. Key tables:

| Table | Purpose |
|-------|---------|
| `playlists` / `playlist_tracks` | User playlists with track ordering |
| `favorites` | Liked tracks |
| `play_history` | Timestamped play history (indexed) |
| `cached_streams` | Stream URL cache (5-hour TTL) |
| `cached_audio` | Offline download metadata |
| `player_queue` / `player_state` | Queue persistence across app restarts |
| `track_engagement` | Play count, skip count, listen duration |
| `artist_affinity` | Computed preference scores for recommendations |

## Setup

```bash
# Install dependencies
npm install --legacy-peer-deps

# Development (requires dev-client, not Expo Go)
npx expo start --dev-client

# Android dev build
npx expo run:android

# Android release APK
cd android && ./gradlew assembleRelease

# iOS dev build
npx expo run:ios
```

> **Note:** `--legacy-peer-deps` is required due to a React 19.1 vs 19.2 peer dependency conflict. JDK 17+ required for Android builds.

## License

This project is for educational and personal use only.
