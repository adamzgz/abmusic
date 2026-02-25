import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { usePlayer } from './usePlayer';
import { useTimerStore } from '@/core/store/timerStore';
import { formatRemaining } from './sleepTimer';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';

// Sticky bar at the bottom of the screen showing the current track.
// Tapping it opens the full player modal.
export function MiniPlayer() {
  const { activeTrack, isPlaying, isBuffering, togglePlayback, skipToNext } =
    usePlayer();
  const timerActive = useTimerStore((s) => s.isActive);
  const timerEndOfTrack = useTimerStore((s) => s.endOfTrack);
  const timerRemaining = useTimerStore((s) => s.remainingMs);

  if (!activeTrack) return null;

  return (
    <TouchableOpacity
      style={styles.container}
      activeOpacity={0.9}
      onPress={() => router.push('/player')}
    >
      <Image
        source={{
          uri: activeTrack.artwork ?? undefined,
        }}
        style={styles.artwork}
      />
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>
          {activeTrack.title ?? 'Unknown'}
        </Text>
        <Text style={styles.artist} numberOfLines={1}>
          {activeTrack.artist ?? 'Unknown artist'}
        </Text>
      </View>

      {/* Sleep timer indicator */}
      {timerActive && (
        <View style={styles.timerPill}>
          <Ionicons name="moon" size={10} color={colors.primary} />
          <Text style={styles.timerText}>
            {timerEndOfTrack ? '1x' : formatRemaining(timerRemaining)}
          </Text>
        </View>
      )}

      <TouchableOpacity
        onPress={(e) => {
          e.stopPropagation();
          togglePlayback();
        }}
        style={styles.button}
      >
        <Ionicons
          name={isBuffering ? 'hourglass' : isPlaying ? 'pause' : 'play'}
          size={24}
          color={colors.text}
        />
      </TouchableOpacity>
      <TouchableOpacity
        onPress={(e) => {
          e.stopPropagation();
          skipToNext();
        }}
        style={styles.button}
      >
        <Ionicons name="play-forward" size={20} color={colors.text} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceVariant,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: 0.5,
    borderTopColor: colors.border,
  },
  artwork: {
    width: 40,
    height: 40,
    borderRadius: 6,
    backgroundColor: colors.surface,
  },
  info: {
    flex: 1,
    marginLeft: spacing.sm,
    marginRight: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  artist: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 1,
  },
  timerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.surface,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    marginRight: spacing.xs,
  },
  timerText: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '700',
  },
  button: {
    padding: spacing.sm,
  },
});
