import { requireNativeModule, EventEmitter } from 'expo-modules-core';

interface DownloadResult {
  bytesWritten: number;
  path: string;
}

interface ProgressEvent {
  downloadId: string;
  progress: number; // 0-1
}

const CronetDownload = requireNativeModule('CronetDownload');

/**
 * Clear all WebView cookies and storage.
 * Must be called before recycling WebView to get a truly fresh YouTube session.
 */
export async function clearWebViewCookies(): Promise<boolean> {
  return CronetDownload.clearWebViewCookies();
}

type CronetEvents = {
  onDownloadProgress: (event: ProgressEvent) => void;
};

const emitter = new EventEmitter<CronetEvents>(CronetDownload);

/**
 * Download a file using Cronet (Chrome TLS fingerprint) with chunked
 * range requests to bypass YouTube CDN throttling.
 *
 * @param url          - Stream URL
 * @param destPath     - Absolute file path to write to
 * @param totalSize    - Content-Length from InnerTube (0 = unknown, falls back to single request)
 * @param downloadId   - Unique ID for progress events (typically the track ID)
 * @param onProgress   - Optional callback receiving 0-1 progress
 */
export async function downloadWithCronet(
  url: string,
  destPath: string,
  totalSize: number = 0,
  downloadId: string = '',
  onProgress?: (progress: number) => void,
): Promise<DownloadResult> {
  let sub: { remove(): void } | null = null;

  if (onProgress && downloadId) {
    sub = emitter.addListener('onDownloadProgress', (event: ProgressEvent) => {
      if (event.downloadId === downloadId) {
        onProgress(event.progress);
      }
    });
  }

  try {
    const result: DownloadResult = await CronetDownload.download(
      url,
      destPath,
      totalSize,
      downloadId,
    );
    // Ensure final 100% is reported
    onProgress?.(1);
    return result;
  } finally {
    sub?.remove();
  }
}
