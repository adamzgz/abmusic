import { requireNativeModule } from 'expo-modules-core';

interface DownloadResult {
  bytesWritten: number;
  path: string;
}

const CronetDownload = requireNativeModule('CronetDownload');

/**
 * Download a file using Cronet (Chrome TLS fingerprint).
 * Bypasses YouTube CDN's OkHttp blocking.
 */
export async function downloadWithCronet(
  url: string,
  destPath: string,
): Promise<DownloadResult> {
  return CronetDownload.download(url, destPath);
}
