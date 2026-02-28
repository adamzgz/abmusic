import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { playTracks } from '@/features/player/playTrack';
import { usePlayerStore } from '@/core/store/playerStore';
import { TrackItem } from '@/components/TrackItem';
import { TrackContextMenu } from '@/components/TrackContextMenu';
import { getAlbumDetail, type AlbumDetail } from '@/features/youtube/home';
import { useColors } from '@/theme/useColors';
import { typography } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import type { MusicTrack } from '@/features/youtube/types';
import type { ColorPalette } from '@/theme/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ARTWORK_SIZE = SCREEN_WIDTH * 0.55;

export default function AlbumDetailScreen() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { id, title: paramTitle, thumbnail: paramThumb } = useLocalSearchParams<{
    id: string;
    title?: string;
    thumbnail?: string;
  }>();
  const [album, setAlbum] = useState<AlbumDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [contextTrack, setContextTrack] = useState<MusicTrack | null>(null);
  const currentTrackId = usePlayerStore((s) => s.queue[s.currentIndex]?.id);

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    getAlbumDetail(id)
      .then(setAlbum)
      .catch((e) => {
        if (__DEV__) console.warn('[Album] Failed to load:', e);
      })
      .finally(() => setIsLoading(false));
  }, [id]);

  const onPlayAll = useCallback(async () => {
    if (!album || album.tracks.length === 0) return;
    await playTracks(album.tracks, 0);
  }, [album]);

  const onShuffleAll = useCallback(async () => {
    if (!album || album.tracks.length === 0) return;
    const shuffled = [...album.tracks].sort(() => Math.random() - 0.5);
    await playTracks(shuffled, 0);
  }, [album]);

  const onTrackPress = useCallback(
    async (track: MusicTrack) => {
      if (!album) return;
      const idx = album.tracks.findIndex((t) => t.id === track.id);
      await playTracks(album.tracks, idx >= 0 ? idx : 0);
    },
    [album],
  );

  // Show placeholder while loading (use params for instant header)
  const displayTitle = album?.title ?? paramTitle ?? 'Album';
  const displayArtist = album?.artist ?? '';
  const displayThumb = album?.thumbnail ?? paramThumb ?? '';
  const trackCount = album?.tracks.length ?? 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <FlatList
        data={album?.tracks ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TrackItem
            track={item}
            onPress={onTrackPress}
            onLongPress={setContextTrack}
            isPlaying={item.id === currentTrackId}
          />
        )}
        ListHeaderComponent={
          <View style={styles.headerSection}>
            {/* Back button */}
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backBtn}
            >
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </TouchableOpacity>

            {/* Album artwork */}
            <View style={styles.artworkWrapper}>
              {displayThumb ? (
                <Image
                  source={{ uri: displayThumb }}
                  style={styles.artwork}
                />
              ) : (
                <View style={[styles.artwork, styles.artworkPlaceholder]}>
                  <Ionicons name="disc" size={64} color={colors.textTertiary} />
                </View>
              )}
            </View>

            {/* Album info */}
            <Text style={styles.albumTitle} numberOfLines={2}>
              {displayTitle}
            </Text>
            {displayArtist ? (
              <Text style={styles.albumArtist} numberOfLines={1}>
                {displayArtist}
              </Text>
            ) : null}
            {trackCount > 0 && (
              <Text style={styles.trackCount}>
                {trackCount} {trackCount === 1 ? 'song' : 'songs'}
                {album?.year ? ` · ${album.year}` : ''}
              </Text>
            )}

            {/* Action buttons */}
            {trackCount > 0 && (
              <View style={styles.actions}>
                <TouchableOpacity style={styles.playAllBtn} onPress={onPlayAll}>
                  <Ionicons name="play" size={20} color={colors.onPrimary} />
                  <Text style={styles.playAllText}>Play All</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.shuffleBtn}
                  onPress={onShuffleAll}
                >
                  <Ionicons name="shuffle" size={20} color={colors.primary} />
                  <Text style={styles.shuffleText}>Shuffle</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Loading */}
            {isLoading && (
              <View style={styles.loading}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No tracks found</Text>
            </View>
          ) : null
        }
        contentContainerStyle={styles.listContent}
      />
      <TrackContextMenu
        track={contextTrack}
        visible={contextTrack !== null}
        onClose={() => setContextTrack(null)}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    headerSection: {
      alignItems: 'center',
      paddingBottom: spacing.lg,
    },
    backBtn: {
      alignSelf: 'flex-start',
      padding: spacing.md,
    },
    artworkWrapper: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.4,
      shadowRadius: 16,
      elevation: 10,
      marginBottom: spacing.lg,
    },
    artwork: {
      width: ARTWORK_SIZE,
      height: ARTWORK_SIZE,
      borderRadius: 12,
      backgroundColor: colors.surface,
    },
    artworkPlaceholder: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    albumTitle: {
      ...typography.h2,
      color: colors.text,
      textAlign: 'center',
      paddingHorizontal: spacing.lg,
    },
    albumArtist: {
      color: colors.textSecondary,
      fontSize: 16,
      marginTop: spacing.xs,
    },
    trackCount: {
      color: colors.textTertiary,
      fontSize: 13,
      marginTop: spacing.xs,
    },
    actions: {
      flexDirection: 'row',
      marginTop: spacing.lg,
      gap: spacing.sm,
    },
    playAllBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      backgroundColor: colors.primary,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm + 2,
      borderRadius: 24,
    },
    playAllText: {
      color: colors.onPrimary,
      fontWeight: '600',
      fontSize: 14,
    },
    shuffleBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      backgroundColor: colors.surfaceVariant,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm + 2,
      borderRadius: 24,
    },
    shuffleText: {
      color: colors.primary,
      fontWeight: '600',
      fontSize: 14,
    },
    loading: {
      paddingVertical: spacing.xl,
    },
    empty: {
      alignItems: 'center',
      paddingVertical: spacing.xxl,
    },
    emptyText: {
      color: colors.textTertiary,
      fontSize: 14,
    },
    listContent: {
      paddingBottom: 120,
    },
  });
