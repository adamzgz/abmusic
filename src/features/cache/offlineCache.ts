import { File, Directory, Paths } from 'expo-file-system';
import { getStreamUrl } from '@/features/youtube/streams';
import { useSettingsStore } from '@/core/store/settingsStore';
import { saveCachedAudio, getCachedAudio, removeCachedAudio } from './offlineDb';
import type { MusicTrack } from '@/features/youtube/types';

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

export async function downloadTrack(track: MusicTrack): Promise<void> {
  if (activeDownloads.has(track.id)) return;
  if (await isDownloaded(track.id)) return;

  // Ensure audio directory exists
  const audioDir = getAudioDir();
  if (!audioDir.exists) {
    audioDir.create();
  }

  const quality = useSettingsStore.getState().audioQuality;
  const stream = await getStreamUrl(track.id, quality);
  const ext = stream.mimeType.includes('webm') ? 'webm' : 'm4a';
  const fileName = `${track.id}.${ext}`;

  activeDownloads.add(track.id);
  const cb = progressListeners.get(track.id);
  cb?.({ trackId: track.id, progress: 0.1, status: 'downloading' });

  try {
    const downloadedFile = await File.downloadFileAsync(
      stream.url,
      new File(audioDir, fileName),
      { idempotent: true }
    );

    const fileSize = downloadedFile.size ?? 0;
    const filePath = downloadedFile.uri;

    await saveCachedAudio(track, filePath, fileSize, stream.mimeType, stream.bitrate);

    cb?.({ trackId: track.id, progress: 1, status: 'complete' });
  } catch (err) {
    cb?.({ trackId: track.id, progress: 0, status: 'error' });
    // Clean up partial file
    try {
      const partialFile = new File(audioDir, fileName);
      if (partialFile.exists) partialFile.delete();
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
