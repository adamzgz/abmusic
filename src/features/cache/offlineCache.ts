import { File, Directory, Paths } from 'expo-file-system';
import { getStreamViaInnertubeVR } from '@/features/youtube/innertube-vr';
import { downloadWithCronet } from 'cronet-download';
import { useSettingsStore } from '@/core/store/settingsStore';
import { saveCachedAudio, getCachedAudio, removeCachedAudio } from './offlineDb';
import type { MusicTrack, StreamInfo } from '@/features/youtube/types';

const AUDIO_DIR_NAME = 'audio';

function getAudioDir(): Directory {
  return new Directory(Paths.document, AUDIO_DIR_NAME);
}

// Track active downloads
const activeDownloads = new Set<string>();

export type DownloadProgress = {
  trackId: string;
  progress: number; // 0-1
  status: 'downloading' | 'complete' | 'error';
};

type ProgressCallback = (progress: DownloadProgress) => void;
const progressListeners = new Map<string, ProgressCallback>();

export function onDownloadProgress(trackId: string, cb: ProgressCallback) {
  progressListeners.set(trackId, cb);
  return () => {
    progressListeners.delete(trackId);
  };
}

export async function isDownloaded(trackId: string): Promise<boolean> {
  const cached = await getCachedAudio(trackId);
  if (!cached) return false;

  const file = new File(cached.filePath);
  if (!file.exists) {
    // Orphaned DB row — clean up
    await removeCachedAudio(trackId);
    return false;
  }
  return true;
}

export async function getOfflineUrl(trackId: string): Promise<string | null> {
  const cached = await getCachedAudio(trackId);
  if (!cached) return null;

  const file = new File(cached.filePath);
  if (!file.exists) {
    await removeCachedAudio(trackId);
    return null;
  }
  return cached.filePath;
}

// Resolve stream URL via InnerTube VR (WebView, Chrome TLS)
async function resolveStreamForDownload(trackId: string): Promise<StreamInfo> {
  const quality = useSettingsStore.getState().audioQuality;
  const stream = await getStreamViaInnertubeVR(trackId, quality);
  if (__DEV__) console.log('[download] VR resolved, itag:', stream.itag);
  return stream;
}

export async function downloadTrack(track: MusicTrack): Promise<void> {
  if (activeDownloads.has(track.id)) return;
  if (await isDownloaded(track.id)) return;

  // Ensure audio directory exists
  const audioDir = getAudioDir();
  if (!audioDir.exists) {
    audioDir.create();
  }

  activeDownloads.add(track.id);
  const cb = progressListeners.get(track.id);
  cb?.({ trackId: track.id, progress: 0.05, status: 'downloading' });

  try {
    // Resolve stream URL (same chain as playback)
    const stream = await resolveStreamForDownload(track.id);
    cb?.({ trackId: track.id, progress: 0.1, status: 'downloading' });

    const ext = stream.mimeType.includes('webm') ? 'webm' : 'm4a';
    const fileName = `${track.id}.${ext}`;
    // audioDir.uri is file:///data/... — Cronet needs a plain absolute path
    const dirPath = audioDir.uri.replace(/^file:\/\//, '').replace(/\/+$/, '');
    const destPath = `${dirPath}/${fileName}`;

    if (__DEV__) console.log('[download] Cronet downloading to:', destPath);

    // Download using Cronet (Chrome TLS) — bypasses YouTube CDN blocking
    const result = await downloadWithCronet(stream.url, destPath);

    if (__DEV__) console.log('[download] complete:', result.bytesWritten, 'bytes');

    // Store as file:// URI for TrackPlayer compatibility
    const filePath = result.path.startsWith('file://') ? result.path : `file://${result.path}`;
    await saveCachedAudio(
      track,
      filePath,
      result.bytesWritten,
      stream.mimeType,
      stream.bitrate,
    );

    cb?.({ trackId: track.id, progress: 1, status: 'complete' });
  } catch (err) {
    cb?.({ trackId: track.id, progress: 0, status: 'error' });
    if (__DEV__) console.error('[download] failed:', err);
    // Clean up partial file
    try {
      const ext = 'm4a'; // best guess for cleanup
      const partialFile = new File(audioDir, `${track.id}.${ext}`);
      if (partialFile.exists) partialFile.delete();
      const partialWebm = new File(audioDir, `${track.id}.webm`);
      if (partialWebm.exists) partialWebm.delete();
    } catch {}
    throw err;
  } finally {
    activeDownloads.delete(track.id);
  }
}

export async function deleteDownload(trackId: string): Promise<void> {
  const cached = await getCachedAudio(trackId);
  if (cached) {
    try {
      const file = new File(cached.filePath);
      if (file.exists) file.delete();
    } catch {}
    await removeCachedAudio(trackId);
  }
}

export function isActivelyDownloading(trackId: string): boolean {
  return activeDownloads.has(trackId);
}
