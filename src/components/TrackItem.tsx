import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { MusicTrack } from '@/features/youtube/types';
import { DownloadButton } from './DownloadButton';
import { formatTime } from '@/core/utils/formatTime';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';

interface TrackItemProps {
  track: MusicTrack;
  onPress: (track: MusicTrack) => void;
  onLongPress?: (track: MusicTrack) => void;
  isPlaying?: boolean;
  showDownload?: boolean;
}

export function TrackItem({ track, onPress, onLongPress, isPlaying, showDownload = true }: TrackItemProps) {
  return (
    <TouchableOpacity
      style={[styles.container, isPlaying && styles.playing]}
      onPress={() => onPress(track)}
      onLongPress={() => onLongPress?.(track)}
      delayLongPress={400}
      activeOpacity={0.6}
    >
      <View style={styles.thumbnailContainer}>
        <Image source={{ uri: track.thumbnail }} style={styles.thumbnail} />
        {isPlaying && (
          <View style={styles.playingOverlay}>
            <Ionicons name="musical-note" size={16} color="#fff" />
          </View>
        )}
      </View>
      <View style={styles.info}>
        <Text
          style={[styles.title, isPlaying && styles.titlePlaying]}
          numberOfLines={1}
        >
          {track.title}
        </Text>
        <Text style={styles.artist} numberOfLines={1}>
          {track.artist}
          {track.album ? ` · ${track.album}` : ''}
        </Text>
      </View>
      {showDownload && <DownloadButton track={track} />}
      <Text style={[styles.duration, isPlaying && styles.durationPlaying]}>
        {formatTime(track.duration)}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  playing: {
    backgroundColor: 'rgba(187, 134, 252, 0.08)',
  },
  thumbnailContainer: {
    position: 'relative',
  },
  thumbnail: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  playingOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    marginLeft: spacing.md,
    marginRight: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '500',
  },
  titlePlaying: {
    color: colors.primary,
    fontWeight: '600',
  },
  artist: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  duration: {
    color: colors.textTertiary,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  durationPlaying: {
    color: colors.primary,
  },
});
