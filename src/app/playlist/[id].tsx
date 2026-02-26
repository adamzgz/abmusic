import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import {
  getPlaylistTracks,
  removeTrackFromPlaylist,
} from '@/features/library/playlists';
import { playTrack, playTracks } from '@/features/player/playTrack';
import { usePlayerStore } from '@/core/store/playerStore';
import { TrackItem } from '@/components/TrackItem';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import type { MusicTrack } from '@/features/youtube/types';

export default function PlaylistDetailScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name: string }>();
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const currentTrackId = usePlayerStore((s) => s.queue[s.currentIndex]?.id);

  const loadTracks = useCallback(async () => {
    if (!id) return;
    const t = await getPlaylistTracks(id);
    setTracks(t);
  }, [id]);

  useEffect(() => {
    loadTracks();
  }, [loadTracks]);

  const onPlayAll = useCallback(async () => {
    if (tracks.length === 0) return;
    await playTracks(tracks, 0);
  }, [tracks]);

  const onShuffleAll = useCallback(async () => {
    if (tracks.length === 0) return;
    const shuffled = [...tracks].sort(() => Math.random() - 0.5);
    await playTracks(shuffled, 0);
  }, [tracks]);

  const onTrackPress = useCallback(async (track: MusicTrack) => {
    const idx = tracks.findIndex((t) => t.id === track.id);
    await playTracks(tracks, idx >= 0 ? idx : 0);
  }, [tracks]);

  const onRemoveTrack = useCallback(
    (track: MusicTrack) => {
      Alert.alert('Remove Track', `Remove "${track.title}" from playlist?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            if (!id) return;
            await removeTrackFromPlaylist(id, track.id);
            loadTracks();
          },
        },
      ]);
    },
    [id, loadTracks],
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.title} numberOfLines={1}>
            {name || 'Playlist'}
          </Text>
          <Text style={styles.subtitle}>
            {tracks.length} {tracks.length === 1 ? 'song' : 'songs'}
          </Text>
        </View>
      </View>

      {/* Action buttons */}
      {tracks.length > 0 && (
        <View style={styles.actions}>
          <TouchableOpacity style={styles.playAllBtn} onPress={onPlayAll}>
            <Ionicons name="play" size={20} color={colors.onPrimary} />
            <Text style={styles.playAllText}>Play All</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.shuffleBtn} onPress={onShuffleAll}>
            <Ionicons name="shuffle" size={20} color={colors.primary} />
            <Text style={styles.shuffleText}>Shuffle</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Track list */}
      <FlatList
        data={tracks}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.trackRow}>
            <View style={styles.trackItem}>
              <TrackItem
                track={item}
                onPress={onTrackPress}
                isPlaying={item.id === currentTrackId}
                showDownload={false}
              />
            </View>
            <TouchableOpacity
              onPress={() => onRemoveTrack(item)}
              style={styles.removeBtn}
            >
              <Ionicons
                name="close-circle-outline"
                size={20}
                color={colors.textTertiary}
              />
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons
              name="musical-notes-outline"
              size={48}
              color={colors.surfaceVariant}
            />
            <Text style={styles.emptyTitle}>No songs yet</Text>
            <Text style={styles.emptySubtitle}>
              Add songs from search or long-press a track
            </Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  backBtn: {
    padding: spacing.xs,
    marginRight: spacing.sm,
  },
  headerInfo: {
    flex: 1,
  },
  title: {
    ...typography.h2,
    color: colors.text,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
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
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trackItem: {
    flex: 1,
  },
  removeBtn: {
    padding: spacing.sm,
    marginRight: spacing.sm,
  },
  listContent: {
    paddingBottom: 100,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    gap: spacing.sm,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  emptySubtitle: {
    ...typography.bodySmall,
    color: colors.textTertiary,
  },
});
