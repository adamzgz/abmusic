import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import type { MusicTrack } from '@/features/youtube/types';
import { DownloadButton } from './DownloadButton';
import { formatTime } from '@/core/utils/formatTime';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';

interface TrackItemProps {
  track: MusicTrack;
  onPress: (track: MusicTrack) => void;
  isPlaying?: boolean;
  showDownload?: boolean;
}

export function TrackItem({ track, onPress, isPlaying, showDownload = true }: TrackItemProps) {
  return (
    <TouchableOpacity
      style={[styles.container, isPlaying && styles.playing]}
      onPress={() => onPress(track)}
      activeOpacity={0.7}
    >
      <Image source={{ uri: track.thumbnail }} style={styles.thumbnail} />
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
      <Text style={styles.duration}>{formatTime(track.duration)}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  playing: {
    backgroundColor: colors.surfaceVariant,
  },
  thumbnail: {
    width: 48,
    height: 48,
    borderRadius: 6,
    backgroundColor: colors.surface,
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
  },
  artist: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  duration: {
    color: colors.textTertiary,
    fontSize: 12,
  },
});
