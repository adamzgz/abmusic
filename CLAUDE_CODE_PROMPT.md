# Prompt para Claude Code — Proyecto "SonicFlow"

## Contexto

Quiero construir una app de streaming de música open-source con React Native (Expo si es viable, bare workflow si no). La app usa YouTube como fuente de audio pero sin depender de servidores intermediarios como Piped o Invidious — todo el procesamiento ocurre directamente en el dispositivo del usuario.

## Stack tecnológico decidido

- **Frontend:** React Native (TypeScript)
- **Audio source:** `youtubei.js` (npm: youtubei.js) — cliente JavaScript para la API privada InnerTube de YouTube. Proporciona búsqueda, metadatos y URLs de streaming de audio directamente desde el CDN de Google. También tiene endpoints dedicados de YouTube Music (`yt.music.search()`, `yt.music.getArtist()`, `yt.music.getUpNext()`, etc.)
- **Reproductor:** `react-native-track-player` v4+ — soporte para reproducción en background, controles en lock screen, cola de reproducción, streaming HLS/DASH
- **Metadatos complementarios:** MusicBrainz API (gratis, sin auth) para datos de artista/álbum/género
- **Recomendaciones:** Last.fm API (gratis con API key pública) para artistas/tracks similares
- **Letras:** LRCLib API (gratis, sin auth, ~3M letras sincronizadas)
- **Base de datos local:** SQLite con WatermelonDB o expo-sqlite para playlists, historial, caché offline-first
- **Estado global:** Zustand

## Fase 0 — Investigación (HACER ESTO PRIMERO)

Antes de escribir código, necesito que investigues y documentes en un archivo `RESEARCH.md`:

1. **youtubei.js + React Native:**
   - ¿Funciona directamente en React Native o necesita polyfills?
   - ¿Las peticiones HTTP desde React Native tienen problemas de CORS con los endpoints de InnerTube? (En teoría no, porque RN no es un browser, pero confírmalo)
   - ¿Se necesita proxy o funciona directo desde el dispositivo?
   - Buscar issues en GitHub de youtubei.js relacionados con React Native
   - ¿Qué dependencias nativas podría necesitar? (crypto, streams, etc.)
   - Alternativa: si youtubei.js no funciona directo en RN, ¿podría correr en un servidor ligero embebido o necesitaríamos un backend mínimo?

2. **react-native-track-player:**
   - ¿Soporta streaming directo desde URLs de googlevideo.com (CDN de YouTube)?
   - ¿Qué formatos de audio soporta? (opus, webm, m4a, mp4a)
   - ¿Funciona con URLs temporales que expiran (~6h)?
   - ¿Cómo manejar la renovación de URLs cuando expiran?
   - ¿Es compatible con Expo managed workflow o requiere bare?

3. **Expo vs Bare Workflow:**
   - ¿Podemos usar Expo con expo-dev-client para tener lo mejor de ambos mundos?
   - ¿Qué librerías del stack requieren código nativo?
   - Recomendar la mejor aproximación

4. **YouTube Music vs YouTube normal:**
   - ¿Qué ventajas tiene usar los endpoints de YouTube Music de youtubei.js?
   - ¿Los streams de audio son diferentes (mejor calidad, solo audio)?
   - ¿El "Up Next" / radio automática funciona bien?

5. **Estructura de datos de audio:**
   - ¿Qué itags/formatos devuelve YouTube para audio-only?
   - ¿Cuál es la mejor calidad disponible sin video?
   - ¿Cómo elegir el formato óptimo para streaming móvil (balancear calidad vs datos)?

## Fase 1 — Esqueleto del proyecto

Una vez completada la investigación, crear la estructura base:

```
sonicflow/
├── src/
│   ├── app/                    # Navegación (React Navigation o Expo Router)
│   │   ├── (tabs)/
│   │   │   ├── home.tsx        # Feed principal, radio rápida
│   │   │   ├── search.tsx      # Búsqueda
│   │   │   ├── library.tsx     # Playlists, favoritos, historial
│   │   │   └── _layout.tsx
│   │   └── _layout.tsx
│   ├── features/
│   │   ├── player/
│   │   │   ├── service.ts              # Configuración react-native-track-player
│   │   │   ├── usePlayer.ts            # Hook principal del reproductor
│   │   │   ├── MiniPlayer.tsx          # Barra inferior mini player
│   │   │   ├── FullPlayer.tsx          # Vista expandida del reproductor
│   │   │   └── queue.ts               # Gestión de cola
│   │   ├── youtube/
│   │   │   ├── client.ts              # Singleton de youtubei.js Innertube
│   │   │   ├── search.ts              # Búsqueda de música
│   │   │   ├── streams.ts             # Resolución de URLs de audio
│   │   │   ├── radio.ts               # Lógica de radio/Up Next
│   │   │   └── types.ts
│   │   ├── metadata/
│   │   │   ├── musicbrainz.ts         # Cliente MusicBrainz
│   │   │   ├── lastfm.ts             # Cliente Last.fm
│   │   │   └── lyrics.ts             # Cliente LRCLib
│   │   ├── radio/
│   │   │   ├── engine.ts             # Motor de radio personalizada
│   │   │   ├── strategies/
│   │   │   │   ├── artistRadio.ts    # Radio por artista similar
│   │   │   │   ├── genreRadio.ts     # Radio por género
│   │   │   │   ├── discoveryRadio.ts # Radio descubrimiento
│   │   │   │   └── mixRadio.ts       # Radio mix personalizada
│   │   │   └── types.ts
│   │   └── library/
│   │       ├── playlists.ts
│   │       ├── favorites.ts
│   │       └── history.ts
│   ├── core/
│   │   ├── database/
│   │   │   ├── schema.ts             # Schema SQLite
│   │   │   ├── migrations.ts
│   │   │   └── models/
│   │   │       ├── Track.ts
│   │   │       ├── Playlist.ts
│   │   │       ├── PlayHistory.ts
│   │   │       └── CachedStream.ts   # Cache de URLs de stream con TTL
│   │   ├── store/
│   │   │   ├── playerStore.ts        # Zustand store del reproductor
│   │   │   ├── searchStore.ts
│   │   │   └── settingsStore.ts
│   │   └── utils/
│   │       ├── formatTime.ts
│   │       ├── imageColors.ts        # Extraer colores dominantes de artwork
│   │       └── networkUtils.ts
│   ├── components/
│   │   ├── TrackItem.tsx
│   │   ├── ArtistCard.tsx
│   │   ├── PlaylistCard.tsx
│   │   ├── LyricsView.tsx
│   │   └── RadioButton.tsx
│   └── theme/
│       ├── colors.ts
│       ├── spacing.ts
│       └── typography.ts
├── assets/
├── RESEARCH.md                        # Documentación de la investigación
├── README.md
├── app.json
├── package.json
└── tsconfig.json
```

## Fase 2 — Implementación core (MVP)

Implementar en este orden de prioridad:

### 2.1 — YouTube client + resolución de audio
- Inicializar `Innertube.create()` como singleton
- Función de búsqueda que devuelva resultados tipados
- Función que dado un videoId devuelva la mejor URL de audio-only
- Cache de URLs resueltas con TTL de 5 horas (las URLs expiran a las ~6h)
- Manejo de errores y reintentos

### 2.2 — Reproductor
- Configurar `react-native-track-player` con playback service
- Implementar play, pause, skip, previous, seek
- Cola de reproducción
- Background playback + lock screen controls
- MiniPlayer sticky en la parte inferior
- FullPlayer con artwork, progreso, controles

### 2.3 — Búsqueda
- Pantalla de búsqueda con debounce
- Resultados: canciones, artistas, álbumes, playlists
- Sugerencias de búsqueda (youtubei.js tiene `yt.getSearchSuggestions()`)
- Tap en resultado → reproducir

### 2.4 — Radio
- Radio básica: usar `yt.music.getUpNext(videoId)` para cola automática
- Cuando quedan 3 canciones en la cola, pedir más
- Radio por artista: Last.fm similar artists → buscar top tracks → encolar
- Indicador visual de modo radio activo

### 2.5 — Librería
- Playlists locales (crear, editar, eliminar)
- Favoritos (corazón)
- Historial de reproducción
- Todo persistido en SQLite

## Fase 3 — Features avanzados (post-MVP)

- Letras sincronizadas (LRCLib)
- Radio inteligente con múltiples estrategias
- Caché de audio para reproducción offline
- Ecualizador
- Sleep timer
- Tema dinámico basado en el artwork
- Crossfade entre canciones
- Importar playlists de YouTube/Spotify (solo los nombres, buscar las canciones)

## Restricciones y decisiones de diseño

- **Sin backend propio.** Todo corre en el dispositivo.
- **Sin monetización.** Proyecto open-source para portfolio.
- **Sin la palabra "YouTube" en el nombre ni en el README.** Describir como "reproductor de música con fuentes de audio pluggable."
- **Nombre del proyecto:** SonicFlow (o sugerir alternativas si encuentras conflictos)
- **Idioma del código:** TypeScript estricto, inglés para código y comentarios
- **Target:** Android primero (iOS después, pero no romper compatibilidad)
- **Mínimo Android:** API 24 (Android 7.0)
- **Diseño:** Material Design 3 / Material You con tema oscuro por defecto

## Lo que NO hacer

- No usar Piped, Invidious ni ningún servicio intermediario
- No usar la YouTube Data API v3 oficial (tiene quota y no da streams)
- No usar `@distube/ytdl-core` (deprecated, recomienda youtubei.js)
- No poner credenciales hardcodeadas
- No descargar/guardar archivos de audio completos (solo streaming + caché temporal)
- No usar Spotify API para nada

## Empieza por la Fase 0 (investigación) y documéntalo todo en RESEARCH.md antes de tocar código.
