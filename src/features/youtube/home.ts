import { getInnertube } from './client';
import type { MusicTrack } from './types';

export type HomeItemType = 'song' | 'album' | 'playlist';

export interface HomeItem {
  type: HomeItemType;
  // For songs: YouTube videoId. For albums/playlists: browseId.
  id: string;
  title: string;
  artist: string;
  thumbnail: string;
  duration: number; // 0 for albums/playlists
}

export interface HomeSection {
  title: string;
  items: HomeItem[];
}

/**
 * Fetch YouTube Music homepage sections (trending, recommendations, etc.).
 * Uses yt.music.getHomeFeed() which returns MusicCarouselShelf sections.
 */
export async function getHomeSections(): Promise<HomeSection[]> {
  const yt = await getInnertube();
  const home = await yt.music.getHomeFeed();

  const sections: HomeSection[] = [];

  if (!home.sections) return sections;

  for (const section of home.sections) {
    const title =
      (section as any).header?.title?.text ??
      (section as any).header?.title?.toString?.() ??
      '';

    if (!title) continue;

    const items: HomeItem[] = [];

    const contents = (section as any).contents ?? [];
    for (const item of contents) {
      const parsed = parseHomeItem(item);
      if (parsed) items.push(parsed);
    }

    if (items.length > 0) {
      sections.push({ title, items });
    }
  }

  return sections;
}

/**
 * Fetch all tracks from a YouTube Music album.
 */
export interface AlbumDetail {
  title: string;
  artist: string;
  thumbnail: string;
  year?: string;
  tracks: MusicTrack[];
}

export async function getAlbumDetail(albumId: string): Promise<AlbumDetail> {
  const yt = await getInnertube();
  const album = await yt.music.getAlbum(albumId);

  // Extract album-level thumbnail from header
  const headerThumb =
    (album as any).header?.thumbnails?.[(album as any).header?.thumbnails?.length - 1]?.url ??
    (album as any).header?.thumbnail?.contents?.[(album as any).header?.thumbnail?.contents?.length - 1]?.url ??
    (album as any).background?.[(album as any).background?.length - 1]?.url ??
    '';

  const albumTitle =
    (album as any).header?.title?.text ??
    (album as any).header?.title?.toString?.() ??
    'Unknown album';

  const albumArtist =
    (album as any).header?.subtitle?.text ??
    (album as any).header?.strapline_text_one?.text ??
    'Unknown artist';

  const albumYear =
    (album as any).header?.subtitle?.text?.match(/\d{4}/)?.[0] ?? undefined;

  const tracks = (album?.contents ?? [])
    .map((item: any) => ({
      id: item.video_id ?? item.id ?? item.endpoint?.payload?.videoId ?? '',
      title: item.title?.text ?? item.title ?? 'Unknown',
      artist:
        item.artists?.[0]?.name ??
        item.author?.name ??
        albumArtist,
      duration: item.duration?.seconds ?? 0,
      thumbnail: item.thumbnails?.[0]?.url ?? item.thumbnail?.[0]?.url ?? headerThumb,
      album: albumTitle,
      albumId,
    }))
    .filter((t: MusicTrack) => t.id !== '');

  return {
    title: albumTitle,
    artist: albumArtist,
    thumbnail: headerThumb,
    year: albumYear,
    tracks,
  };
}

export async function getAlbumTracks(albumId: string): Promise<MusicTrack[]> {
  const detail = await getAlbumDetail(albumId);
  return detail.tracks;
}

/**
 * Fetch all tracks from a YouTube Music playlist.
 */
export async function getPlaylistTracks(playlistId: string): Promise<MusicTrack[]> {
  const yt = await getInnertube();
  const playlist = await yt.music.getPlaylist(playlistId);

  if (!playlist?.contents) return [];

  return playlist.contents
    .map((item: any) => ({
      id: item.video_id ?? item.id ?? item.endpoint?.payload?.videoId ?? '',
      title: item.title?.text ?? item.title ?? 'Unknown',
      artist: item.artists?.[0]?.name ?? item.author ?? 'Unknown artist',
      duration: item.duration?.seconds ?? 0,
      thumbnail: item.thumbnails?.[0]?.url ?? item.thumbnail?.[0]?.url ?? '',
    }))
    .filter((t: MusicTrack) => t.id !== '');
}

function parseHomeItem(item: any): HomeItem | null {
  const itemType: string = item.item_type ?? '';

  // MusicTwoRowItem.id prefers browseId over videoId (see youtubei.js source).
  // We need to extract the correct ID based on item type.
  if (itemType === 'album') {
    const browseId = item.endpoint?.payload?.browseId ?? item.id ?? '';
    if (!browseId) return null;

    return {
      type: 'album',
      id: browseId,
      title:
        item.title?.text ?? item.title?.toString?.() ?? item.title ?? 'Unknown',
      artist:
        item.artists?.[0]?.name ??
        item.subtitle?.text ??
        item.author?.name ??
        'Unknown artist',
      thumbnail:
        item.thumbnail?.[0]?.url ??
        item.thumbnail?.contents?.[0]?.url ??
        item.thumbnails?.[0]?.url ??
        '',
      duration: 0,
    };
  }

  if (itemType === 'playlist') {
    const browseId = item.endpoint?.payload?.browseId ?? item.id ?? '';
    if (!browseId) return null;

    return {
      type: 'playlist',
      id: browseId,
      title:
        item.title?.text ?? item.title?.toString?.() ?? item.title ?? 'Unknown',
      artist:
        item.subtitle?.text ??
        item.artists?.[0]?.name ??
        item.author?.name ??
        'Unknown',
      thumbnail:
        item.thumbnail?.[0]?.url ??
        item.thumbnail?.contents?.[0]?.url ??
        item.thumbnails?.[0]?.url ??
        '',
      duration: 0,
    };
  }

  // Skip artists and unknown types — not playable
  if (itemType === 'artist' || itemType === 'unknown') return null;

  // Songs, videos, endpoints — extract videoId
  const videoId =
    item.endpoint?.payload?.videoId ??
    // For MusicResponsiveListItem, item.id may be the videoId directly
    (item.video_id ?? '');

  // Fallback: if item.id looks like a YouTube videoId (11 chars, no known prefix)
  const fallbackId = item.id ?? '';
  const id =
    videoId ||
    (fallbackId && !fallbackId.startsWith('MPRE') && !fallbackId.startsWith('VL') && !fallbackId.startsWith('UC')
      ? fallbackId
      : '');

  if (!id) return null;

  const title =
    item.title?.text ??
    item.title?.toString?.() ??
    item.title ??
    'Unknown';

  const artist =
    item.artists?.[0]?.name ??
    item.subtitle?.text ??
    item.subtitle?.toString?.() ??
    item.author?.name ??
    'Unknown artist';

  const thumbnail =
    item.thumbnail?.[0]?.url ??
    item.thumbnail?.contents?.[0]?.url ??
    item.thumbnails?.[0]?.url ??
    '';

  const duration = item.duration?.seconds ?? 0;

  return { type: 'song', id, title, artist, duration, thumbnail };
}
