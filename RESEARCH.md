# RESEARCH.md — Fase 0: Investigación Técnica de ABMusic

> Investigación completada el 24/02/2026. Cada sección incluye fuentes verificadas.

---

## 1. youtubei.js + React Native

### ¿Funciona directamente en React Native?

**Sí, con soporte oficial.** El `package.json` de YouTube.js incluye un export condicional dedicado:

```json
"react-native": "./dist/src/platform/react-native.js"
```

El archivo `src/platform/react-native.ts` configura automáticamente:
- **Storage:** Usa `react-native-mmkv` (almacenamiento clave-valor rápido vía JSI)
- **Crypto:** Polyfill de web-crypto para SHA-1
- **Runtime flag:** Se marca como `runtime: 'react-native'` y `server: false`

**Proyecto real funcionando:** [ReactTube](https://github.com/Duell10111/ReactTube) — reproductor de YouTube completo para Apple TV y móviles con React Native + YouTube.js.

### Polyfills necesarios

| API | Polyfill | Razón |
|-----|----------|-------|
| `btoa` / `atob` | `base-64` | No disponible en Hermes |
| `URL` / `URLSearchParams` | `react-native-url-polyfill` | Implementación incompleta en RN |
| `TextEncoder` / `TextDecoder` | `text-encoding-polyfill` | No disponible en Hermes |
| `ReadableStream` | `web-streams-polyfill` | Necesario para streaming |
| `EventTarget` | `event-target-polyfill` | Necesario para eventos internos |
| `crypto.subtle.digest` | `expo-crypto` | Para firma de requests |
| Storage (cache) | `react-native-mmkv` | Para cachear tokens y player |

**Configuración de Metro (crítico):**
```js
// metro.config.js
module.exports = {
  resolver: {
    unstable_enablePackageExports: true, // Sin esto no resuelve el módulo
  }
};
```

**Dependencias Babel:**
- `@babel/plugin-syntax-import-attributes`
- `@babel/plugin-proposal-export-namespace-from`

### CORS — No es problema

React Native ejecuta peticiones HTTP a nivel nativo (OkHttp en Android, NSURLSession en iOS). No hay restricciones CORS. Las peticiones a los endpoints de InnerTube funcionan directamente desde el dispositivo.

El proxy solo es obligatorio para uso en browser. En RN no se necesita.

### ⚠️ Issue crítico: Freeze en inicialización (#919)

`Innertube.create()` parsea el JavaScript del player de YouTube para extraer funciones de descifrado:
- **Consume mucha CPU y memoria**
- **Bloquea el hilo principal de la UI**
- En primera ejecución puede tardar **10+ segundos**

**Soluciones:**
1. `Innertube.create({ retrieve_player: false })` — no parsea el player, pero necesitas resolver URLs de otra forma
2. Pre-cachear el player parseado (solo ~4KB)
3. Mover la inicialización a un background thread

### Issues relevantes en GitHub

| Issue | Problema | Solución |
|-------|----------|----------|
| [#919](https://github.com/LuanRT/YouTube.js/issues/919) | App se congela durante `Innertube.create()` | `retrieve_player: false`, pre-cache, background thread |
| [#960](https://github.com/LuanRT/YouTube.js/issues/960) | SHA1 hash cuelga en RN | Usar `expo-crypto` en lugar del polyfill por defecto |
| [#667](https://github.com/LuanRT/YouTube.js/issues/667) | Metro no encuentra el entry point | `unstable_enablePackageExports: true` |
| [#868](https://github.com/LuanRT/YouTube.js/issues/868) | MMKV incompatible en debugger remoto | Actualizar MMKV o usar storage en memoria |

### Veredicto

✅ **Viable para producción.** Empezar con YouTube.js directo en RN con los polyfills listados. Usar `expo-crypto` para SHA-1 y evaluar el impacto del freeze de inicialización en dispositivos reales.

---

## 2. react-native-track-player v4+

### Streaming desde googlevideo.com

**Sí funciona.** react-native-track-player acepta cualquier URL HTTP/HTTPS. Soporta custom headers y user-agent:

```typescript
await TrackPlayer.add({
  id: 'track-1',
  url: 'https://rr1---sn-xxx.googlevideo.com/videoplayback?expire=...&signature=...',
  title: 'Song Title',
  artist: 'Artist',
  headers: { 'User-Agent': 'com.google.android.youtube/...' },
});
```

Usa ExoPlayer en Android (soporte excelente para streaming HTTPS).

### Formatos de audio soportados

| Formato | Android (ExoPlayer) | iOS (AVPlayer) |
|---------|---------------------|----------------|
| AAC / M4A (MP4) | ✅ | ✅ |
| Opus (WebM/OGG) | ✅ (Android 5.0+) | ❌ |
| MP3 | ✅ | ✅ |
| FLAC | ✅ | ✅ (iOS 11+) |
| WebM (Vorbis) | ✅ | ❌ |

| Protocolo | Android | iOS |
|-----------|---------|-----|
| Direct URL | ✅ | ✅ |
| DASH | ✅ | ❌ |
| HLS | ✅ | ✅ |

**Conclusión:** Para cross-platform, usar M4A/AAC. Para Android-only (nuestro caso inicial), Opus/WebM es la mejor opción.

### URLs temporales que expiran

Este es el **mayor reto técnico.** Las URLs de YouTube expiran a las ~6 horas.

**No existe "lazy URL resolution" nativo.** Cuando añades tracks a la cola, la URL se fija en ese momento. Si expira antes de reproducirse, falla con `PlaybackError`.

**Estrategia recomendada: Rolling Queue (cola rodante)**

En lugar de añadir 100 tracks, mantener solo 3-5 tracks por delante del actual:

```typescript
TrackPlayer.addEventListener(Event.PlaybackActiveTrackChanged, async (event) => {
  const queue = await TrackPlayer.getQueue();
  if (event.index >= queue.length - 2) {
    const freshUrl = await fetchFreshStreamUrl(nextTrackId);
    await TrackPlayer.add({ id: nextTrackId, url: freshUrl, ... });
  }
});
```

**Recuperación por error:**
```typescript
TrackPlayer.addEventListener(Event.PlaybackError, async (error) => {
  const activeTrack = await TrackPlayer.getActiveTrack();
  const freshUrl = await fetchFreshStreamUrl(activeTrack.id);
  await TrackPlayer.load({ ...activeTrack, url: freshUrl }); // load() reemplaza el track actual
});
```

**Nota:** `retry()` re-usa la misma URL (no sirve para URLs expiradas). Usar `load()` para cambiar la URL.

### Renovación de URLs

`updateMetadataForTrack()` **NO permite cambiar la URL** — solo artwork, title, artist, etc.

| Método | Descripción | Limitación |
|--------|-------------|------------|
| `load(track)` | Reemplaza el track actual (v4+) | Solo el track activo |
| `remove()` + `add()` | Quitar y re-añadir con nueva URL | Interrupción breve |
| Rolling queue | Solo añadir tracks justo antes de necesitarlos | Más código, pero más robusto |

### Expo — Requiere dev-client

**No funciona con Expo Go.** Necesita `expo-dev-client` (development builds). La documentación oficial dice: *"A Dev Client is required. Expo Go is not supported."*

No necesita config plugin custom. Se autoenlaza vía autolinking.

### Background playback y lock screen

Funciona out-of-the-box en Android con configuración del Playback Service:

```typescript
// service.ts — corre incluso cuando la UI está destruida
module.exports = async function () {
  TrackPlayer.addEventListener(Event.RemotePlay, () => TrackPlayer.play());
  TrackPlayer.addEventListener(Event.RemotePause, () => TrackPlayer.pause());
  TrackPlayer.addEventListener(Event.RemoteNext, () => TrackPlayer.skipToNext());
  TrackPlayer.addEventListener(Event.RemotePrevious, () => TrackPlayer.skipToPrevious());
};
```

**Issues conocidos:**
- [#2159](https://github.com/doublesymmetry/react-native-track-player/issues/2159): Crash en Android 12+ al cargar tracks en background — necesita testing
- [#2025](https://github.com/doublesymmetry/react-native-track-player/issues/2025): Metadatos desactualizados en lock screen

### Cola de reproducción

Sistema completo: `add()`, `remove()`, `load()`, `setQueue()`, `move()`, `skip()`, `skipToNext()`, `skipToPrevious()`, `removeUpcomingTracks()`, `getQueue()`, `getActiveTrack()`, `reset()`.

Repeat modes: `Off`, `Track`, `Queue`.

### Veredicto

✅ **Viable.** La clave es implementar el patrón de rolling queue para evitar problemas con URLs expiradas. Usar `load()` para recovery. Background audio funciona bien en Android.

---

## 3. Expo vs Bare Workflow

### Recomendación: Expo + CNG + dev-client

La distinción managed/bare **prácticamente ha desaparecido** en 2025-2026. El modelo actual es:

- **CNG (Continuous Native Generation):** `app.json` + config plugins definen la config nativa. Los directorios `ios/` y `android/` se generan bajo demanda con `npx expo prebuild` y NO se commitean.
- **Development Builds:** Reemplazan a Expo Go. Compilas un cliente con tus módulos nativos incluidos.

### Librerías que requieren código nativo

| Librería | Nativo | Notas |
|----------|--------|-------|
| react-native-track-player | ✅ | Servicio Android para background audio |
| expo-sqlite | ✅ (incluido en SDK) | Se autoenlaza, sin config extra |
| react-native-mmkv | ✅ (JSI) | Storage para youtubei.js |
| youtubei.js | ❌ | JavaScript puro (con polyfills) |

**expo-sqlite vs WatermelonDB:** Para playlists, historial y caché, **expo-sqlite es suficiente** y viene integrado en Expo. WatermelonDB solo si necesitas reactividad automática o sync con servidor.

### Config plugins necesarios

react-native-track-player **no necesita config plugin custom.** Se autoenlaza. Solo necesitas:

```json
{
  "expo": {
    "ios": {
      "infoPlist": { "UIBackgroundModes": ["audio"] }
    },
    "plugins": [
      ["expo-build-properties", {
        "android": { "usesCleartextTraffic": true }
      }]
    ]
  }
}
```

Y un entry point custom para el PlaybackService:

```javascript
// AppEntry.js
import { registerRootComponent } from 'expo';
import TrackPlayer from 'react-native-track-player';
import App from './App';
import { PlaybackService } from './service';

registerRootComponent(App);
TrackPlayer.registerPlaybackService(() => PlaybackService);
```

### Builds

| Aspecto | EAS Build (cloud) | Local | GitHub Actions |
|---------|-------------------|-------|----------------|
| Coste | Free: 30 builds/mes | Gratis | Gratis (free tier) |
| Velocidad | ~15-20 min | Depende del hardware | ~20-30 min |
| Signing | Automático | Manual | Semi-automático |

**Para desarrollo:** `npx expo run:android` (local, gratis, rápido).
**Para releases:** `eas build --local` en GitHub Actions o EAS free tier.

### Setup recomendado

```bash
npx create-expo-app@latest abmusic --template blank-typescript
npx expo install expo-sqlite expo-build-properties expo-crypto
npm install react-native-track-player youtubei.js react-native-mmkv zustand
npm install base-64 event-target-polyfill react-native-url-polyfill text-encoding-polyfill web-streams-polyfill
npx expo prebuild
npx expo run:android
```

### Veredicto

✅ **Expo + CNG + dev-client.** Es el enfoque recomendado oficialmente. No se pierde nada vs bare, y se gana todo el tooling de Expo.

---

## 4. YouTube Music vs YouTube Normal

### Endpoints dedicados de YouTube Music en youtubei.js

El namespace `yt.music` usa el client identifier `YTMUSIC`, haciendo que InnerTube trate las peticiones como si vinieran de la app YouTube Music.

| Método | Descripción |
|--------|-------------|
| `yt.music.search(query, { type })` | Búsqueda musical estructurada (songs, albums, artists, playlists, videos) |
| `yt.music.getInfo(videoId)` | Metadata completa + streaming data |
| `yt.music.getArtist(artistId)` | Página de artista (top songs, álbumes, similares) |
| `yt.music.getAlbum(albumId)` | Tracklist completa del álbum |
| `yt.music.getPlaylist(playlistId)` | Playlist con paginación |
| `yt.music.getUpNext(videoId, automix)` | Radio/autoplay queue |
| `yt.music.getRelated(videoId)` | Contenido relacionado |
| `yt.music.getLyrics(videoId)` | Letras de la canción |
| `yt.music.getHomeFeed()` | Feed principal de YT Music |
| `yt.music.getExplore()` | Página de explorar/descubrir |
| `yt.music.getSearchSuggestions(input)` | Autocomplete musical |

### Búsqueda: YouTube Music vs YouTube Normal

**`yt.music.search()` es muy superior para música:**

- Filtra por tipo: `'song'`, `'video'`, `'album'`, `'playlist'`, `'artist'`
- Devuelve entidades musicales estructuradas (artista, álbum, duración, reproducciones)
- Soporta `applyFilter()` para cambiar categoría sin re-buscar
- Paginación con `getContinuation()`

**`yt.search()` normal** devuelve mezcla de videos, covers, tutoriales, reacciones — no útil para un reproductor de música.

### Calidad de audio

| Client | Codec | Max Bitrate |
|--------|-------|-------------|
| WEB (YouTube normal) | Opus | 128 kbps |
| WEB (YouTube normal) | AAC | 256 kbps |
| YTMUSIC (desktop) | Opus | 128 kbps |
| YTMUSIC (desktop) | AAC | 256 kbps |
| YTMUSIC_ANDROID | Opus | 256 kbps |

**Nota:** Los 256kbps Opus tienen un lowpass de 20kHz y resampleo a 48kHz. Para uso práctico, la diferencia es mínima.

### Radio / Up Next

`yt.music.getUpNext(videoId, automix=true)` funciona así:

1. Llama al endpoint `watchNext` con client `YTMUSIC`
2. Si `automix=true`, busca un `AutomixPreviewVideo` y genera una radio automática
3. Devuelve un `PlaylistPanel` con los tracks siguientes

**Se puede pedir más tracks** con `getUpNextContinuation()`, proporcionando radio infinita.

```typescript
const info = await yt.music.getInfo('videoId');
const upNext = await info.getUpNext(true);        // Cola inicial
const more = await info.getUpNextContinuation();   // Más tracks
```

### Veredicto

✅ **Usar `yt.music` para todo.** Búsqueda superior, datos estructurados, radio automática con continuación infinita. Es exactamente lo que necesitamos.

---

## 5. Estructura de Datos de Audio

### Itags de audio disponibles

#### Estándar (siempre disponibles)

| itag | Codec | Contenedor | Bitrate | Sample Rate |
|------|-------|------------|---------|-------------|
| **140** | AAC LC | MP4/M4A | 128 kbps CBR | 44100 Hz |
| **249** | Opus | WebM | ~50 kbps VBR | 48000 Hz |
| **250** | Opus | WebM | ~70 kbps VBR | 48000 Hz |
| **251** | Opus | WebM | ~160 kbps VBR | 48000 Hz |

#### Baja calidad

| itag | Codec | Contenedor | Bitrate | Sample Rate |
|------|-------|------------|---------|-------------|
| **139** | AAC HE v1 | MP4 | 48 kbps | 22050 Hz |
| **599** | AAC | MP4 | ~30 kbps | 22050 Hz |
| **600** | Opus | WebM | ~35 kbps | 48000 Hz |

#### Premium (requieren autenticación)

| itag | Codec | Contenedor | Bitrate | Notas |
|------|-------|------------|---------|-------|
| **141** | AAC LC | MP4 | 256 kbps | Solo YT Music Premium |

### Mejor calidad disponible (gratis)

**itag 251 (Opus ~160kbps VBR, WebM)** — mejor calidad audio-only gratuita. Opus a 160 kbps supera perceptualmente a AAC 128 kbps.

### Compatibilidad Android

- **Opus en WebM:** Soportado nativamente desde Android 5.0 (API 21). Nuestro mínimo es API 24, así que ✅
- **AAC en M4A/MP4:** Soportado desde Android 1.0. Decodificación hardware universal. ✅

### Selección de formatos en youtubei.js

```typescript
// Selección automática
const format = info.chooseFormat({ type: 'audio', quality: 'best' });

// Filtrado manual
const audioFormats = info.streaming_data?.adaptive_formats
  .filter(f => f.has_audio && !f.has_video);

const opus160 = audioFormats?.find(f => f.itag === 251);
const aac128  = audioFormats?.find(f => f.itag === 140);

// Obtener URL
const url = await format.decipher(yt.session.player);
```

### Estrategia de selección recomendada

```
WiFi / calidad alta:   itag 251 (Opus ~160 kbps) — mejor calidad
Datos móviles:         itag 250 (Opus ~70 kbps)  — buena calidad, bajo consumo
Ahorro extremo:        itag 249 (Opus ~50 kbps)  — conexiones lentas
Fallback (cross-plat): itag 140 (AAC 128 kbps)   — compatibilidad universal
```

La ventaja de Opus es tener **3 niveles de calidad** (249/250/251), permitiendo adaptar la calidad a las condiciones de red. AAC solo tiene un nivel práctico (140).

### Veredicto

✅ **Opus como formato principal, AAC como fallback.** Tres niveles de calidad adaptativos. Android 7+ soporta todo sin problemas.

---

## 6. YouTube bloquea URLs de stream desde clientes no-browser (TLS Fingerprinting)

> **Investigación completada el 25/02/2026.** Este es el hallazgo más crítico del proyecto.

### El problema

YouTube devuelve **HTTP 403** cuando ExoPlayer (OkHttp), React Native `fetch`, o `expo-file-system` intentan descargar/streamear URLs de `googlevideo.com`. Esto ocurre **incluso con URLs válidas** — la misma URL que funciona en `curl` falla desde la app.

**Causa raíz:** YouTube identifica el cliente HTTP por su **TLS fingerprint** (JA3/JA4). OkHttp (usado por ExoPlayer y RN fetch) tiene un fingerprint distinto al de Chrome/browsers. YouTube rechaza cualquier fingerprint no-browser a nivel CDN.

### Qué se probó (todo falló)

| Intento | Resultado | Por qué falla |
|---------|-----------|----------------|
| **MWEB + PO Token** (youtubei.js) | 403 en stream URL | CDN bloquea por TLS fingerprint de OkHttp |
| **ANDROID client** (youtubei.js) | 403, `pot: null`, `n: null` | Mismo problema de TLS + sin PO token |
| **WEB_EMBEDDED client** | "This video is unavailable" | Videos musicales no son embeddables |
| **TV_EMBEDDED client** | 403 | Mismo bloqueo CDN |
| **ANDROID_VR API directa** (RN fetch) | "Sign in to confirm you're not a bot" | YouTube detecta OkHttp fingerprint en la API |
| **ANDROID_VR sin API key** | "Sign in to confirm you're not a bot" | Mismo problema |
| **expo-file-system downloadAsync** | 403 | Usa OkHttp internamente |
| **WebView bridge** (Chrome TLS) | "Failed to fetch" → CORS | null origin, luego bot detection |
| **WebView + baseUrl youtube.com** | "Sign in to confirm you're not a bot" | Bot detection va más allá de TLS |
| **WebView + cookies YouTube** | "Sign in to confirm you're not a bot" | Sesión sin autenticación = bot |
| **Piped/Invidious proxies** | 403, 502, shutdown | Todas las instancias públicas bloqueadas o caídas |
| **Custom headers en ExoPlayer** | 403 | Headers correctos pero TLS fingerprint delata |

### Lo que SÍ funciona

**yt-dlp en el host** genera URLs que ExoPlayer puede reproducir:

```bash
# yt-dlp usa el cliente ANDROID_VR (clientName=28, clientVersion=1.71.26)
# No requiere PO tokens ni JS player
python -m yt_dlp -f 'bestaudio[ext=m4a]/bestaudio' -g 'https://www.youtube.com/watch?v=VIDEO_ID'
```

La URL devuelta funciona con `curl` (status 200) y con ExoPlayer (status 200, audio decodificado y reproducido). La diferencia clave: yt-dlp hace la petición `/player` desde Python (requests library) que YouTube no bloquea, y la URL resultante del CDN acepta conexiones de ExoPlayer porque el token de sesión embedded en la URL es válido.

### Solución implementada: Proxy local

```
App (emulador) → http://10.0.2.2:3333/stream/{videoId} → stream-server.py → yt-dlp → URL
                                                                                       ↓
App ← ExoPlayer reproduce la URL directamente ←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←
```

- `stream-server.py` — HTTP server en Python que ejecuta yt-dlp como subprocess
- `android-vr-client.ts` — Cliente en la app que llama al proxy
- `10.0.2.2` — IP del host desde el emulador Android

### Resultado confirmado

```
[stream] resolving via proxy: 46LjJXT2E6c
[stream] got URL, length: 1155
[resolve] HEAD test: 200
state=PLAYING(3), position=1767, buffered position=4863
Creating an asynchronous MediaCodec adapter for track type audio
```

Audio reproduciendo correctamente. MiniPlayer visible con controles play/pause/skip.

### Implicaciones para producción

| Opción | Viabilidad | Notas |
|--------|-----------|-------|
| Cloud proxy (yt-dlp en servidor) | ✅ Alta | Igual que dev pero en la nube. Coste de servidor. |
| NewPipe Extractor (Java, on-device) | 🔶 Media | Usado por NewPipe/ViMusic. Requiere integrar Java con RN. |
| Cobalt API | 🔶 Media | Proxy público, puede ser bloqueado. Self-hosteable. |
| Piped/Invidious | ❌ Baja | Instancias públicas caídas/bloqueadas constantemente |
| youtubei.js directo | ❌ No viable | TLS fingerprint de OkHttp bloqueado por YouTube CDN |

### Lecciones aprendidas

1. **El problema NO es la API `/player`** — es el CDN de stream. Puedes obtener URLs válidas, pero ExoPlayer no puede descargar de ellas.
2. **PO tokens no ayudan** para el bloqueo CDN — son para la API `/player`, no para el download.
3. **WebView tampoco resuelve** — YouTube detecta bots incluso con Chrome TLS si no hay sesión autenticada.
4. **yt-dlp funciona** porque usa ANDROID_VR (no requiere PO token) y Python requests (no bloqueado por TLS fingerprinting).

---

## 7. Resumen de Decisiones Técnicas

| Decisión | Elección | Justificación |
|----------|----------|---------------|
| **Workflow** | Expo + CNG + dev-client | Mejor tooling, sin sacrificar nada |
| **YouTube client (metadata)** | youtubei.js directo en RN | Soporte oficial, funciona con polyfills |
| **YouTube client (streams)** | yt-dlp via proxy server | youtubei.js URLs bloqueadas por TLS fingerprinting (§6) |
| **API** | `yt.music.*` (YouTube Music) | Búsqueda musical, radio, datos estructurados |
| **Audio player** | react-native-track-player v4 | Background audio, lock screen, queue completa |
| **Formato audio** | AAC/M4A via yt-dlp (`bestaudio[ext=m4a]/bestaudio`) | yt-dlp selecciona el mejor formato disponible |
| **Base de datos** | expo-sqlite | Integrado en Expo, sin plugins extra |
| **Estado global** | Zustand | Ligero, ya conocido |
| **Cola de reproducción** | Rolling queue (3-5 tracks) | Evita problemas de URLs expiradas |
| **Navegación** | expo-router | File-based routing, integrado en Expo |

## 8. Riesgos Identificados

| Riesgo | Severidad | Mitigación |
|--------|-----------|------------|
| **YouTube TLS fingerprinting bloquea streams** | **Crítica** | **Resuelto con proxy yt-dlp. Para producción: cloud proxy o NewPipe Extractor.** |
| Dependencia de yt-dlp (solo dev) | Alta | Para producción se necesita solución cloud o on-device |
| Freeze de `Innertube.create()` (~10s) | Alta | `retrieve_player: false`, inicialización en background thread |
| URLs de audio expiran a las ~6h | Media | Rolling queue + recovery con `load()` en `PlaybackError` |
| Crash Android 12+ en background (#2159) | Media | Testing exhaustivo, workaround documentado en issue |
| YouTube cambia API InnerTube | Baja | youtubei.js se actualiza frecuentemente, comunidad activa |
| yt-dlp bloqueado por YouTube | Baja | yt-dlp se actualiza constantemente para evadir bloqueos |
| SHA-1 cuelga con polyfill por defecto | Media | Usar `expo-crypto` en lugar del polyfill web-crypto |

## 9. Fuentes

- [LuanRT/YouTube.js — GitHub](https://github.com/LuanRT/YouTube.js)
- [ReactTube — App RN funcional con YouTube.js](https://github.com/Duell10111/ReactTube)
- [react-native-track-player — Documentación](https://rntp.dev/)
- [react-native-track-player — GitHub](https://github.com/doublesymmetry/react-native-track-player)
- [Expo — Documentación CNG](https://docs.expo.dev/workflow/continuous-native-generation/)
- [YouTube Format IDs — AgentOak (Gist)](https://gist.github.com/AgentOak/34d47c65b1d28829bb17c24c04a0096f)
- [yt-dlp Issue #9724 — YouTube Music Audio Formats](https://github.com/yt-dlp/yt-dlp/issues/9724)
- [Hydrogenaudio — Opus vs AAC comparisons](https://hydrogenaudio.org/)
