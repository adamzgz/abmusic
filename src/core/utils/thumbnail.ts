/**
 * Upscale a lh3.googleusercontent.com thumbnail URL to a higher resolution.
 * YouTube Music thumbnails come as 120x120 by default (=w120-h120-l90-rj).
 * We replace the size params to request a larger version from the same CDN.
 *
 * Only costs ~100 KB extra per image (120px=15KB → 360px=115KB).
 */
export function getHiResThumbnail(url: string | undefined, size = 360): string {
  if (!url) return '';
  // Match the Google image CDN size suffix: =w120-h120-l90-rj or =s120 etc.
  return url.replace(/=w\d+-h\d+-[^\s]*$/, `=w${size}-h${size}-l90-rj`);
}
