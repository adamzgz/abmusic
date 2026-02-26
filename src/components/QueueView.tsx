import { useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePlayerStore } from '@/core/store/playerStore';
import { playTracks } from '@/features/player/playTrack';
import { formatTime } from '@/core/utils/formatTime';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import type { MusicTrack } from '@/features/youtube/types';

interface QueueViewProps {
  visible: boolean;
  onClose: () => void;
}

export function QueueView({ visible, onClose }: QueueViewProps) {
  const queue = usePlayerStore((s) => s.queue);
  const currentIndex = usePlayerStore((s) => s.currentIndex);

  const onTrackPress = useCallback(
    async (index: number) => {
      if (queue.length === 0) return;
      await playTracks(queue, index);
    },
    [queue],
  );

  const upNext = queue.slice(currentIndex + 1);
  const currentTrack = queue[currentIndex];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Queue</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Now Playing */}
        {currentTrack && (
          <>
            <Text style={styles.sectionLabel}>NOW PLAYING</Text>
            <View style={styles.currentTrack}>
              <Image
                source={{ uri: currentTrack.thumbnail }}
                style={styles.thumbnail}
              />
              <View style={styles.trackInfo}>
                <Text style={styles.trackTitle} numberOfLines={1}>
                  {currentTrack.title}
                </Text>
                <Text style={styles.trackArtist} numberOfLines={1}>
                  {currentTrack.artist}
                </Text>
              </View>
              <Ionicons name="musical-note" size={18} color={colors.primary} />
            </View>
          </>
        )}

        {/* Up Next */}
        <Text style={styles.sectionLabel}>
          UP NEXT ({upNext.length})
        </Text>
        <FlatList
          data={upNext}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          renderItem={({ item, index }) => (
            <TouchableOpacity
              style={styles.trackRow}
              onPress={() => onTrackPress(currentIndex + 1 + index)}
              activeOpacity={0.7}
            >
              <Text style={styles.trackIndex}>{index + 1}</Text>
              <Image
                source={{ uri: item.thumbnail }}
                style={styles.thumbnailSmall}
              />
              <View style={styles.trackInfo}>
                <Text style={styles.trackTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.trackArtist} numberOfLines={1}>
                  {item.artist}
                </Text>
              </View>
              <Text style={styles.duration}>{formatTime(item.duration)}</Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No tracks in queue</Text>
            </View>
          }
          contentContainerStyle={styles.listContent}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: 48,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  title: {
    ...typography.h2,
    color: colors.text,
  },
  closeBtn: {
    padding: spacing.xs,
  },
  sectionLabel: {
    ...typography.caption,
    color: colors.textTertiary,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  currentTrack: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surfaceVariant,
    marginHorizontal: spacing.md,
    borderRadius: 10,
    gap: spacing.md,
  },
  thumbnail: {
    width: 48,
    height: 48,
    borderRadius: 6,
    backgroundColor: colors.surface,
  },
  thumbnailSmall: {
    width: 40,
    height: 40,
    borderRadius: 4,
    backgroundColor: colors.surface,
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  trackIndex: {
    color: colors.textTertiary,
    fontSize: 13,
    width: 24,
    textAlign: 'center',
  },
  trackInfo: {
    flex: 1,
  },
  trackTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '500',
  },
  trackArtist: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  duration: {
    color: colors.textTertiary,
    fontSize: 12,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyText: {
    color: colors.textTertiary,
    fontSize: 14,
  },
  listContent: {
    paddingBottom: 40,
  },
});
