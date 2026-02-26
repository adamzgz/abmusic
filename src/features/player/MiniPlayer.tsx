import { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { usePlayer } from './usePlayer';
import { usePlayerStore } from '@/core/store/playerStore';
import { useTimerStore } from '@/core/store/timerStore';
import { formatRemaining } from './sleepTimer';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';

// Sticky bar at the bottom of the screen showing the current track.
// Tapping it opens the full player modal.
export function MiniPlayer() {
  const { activeTrack, isPlaying, isBuffering, progress, togglePlayback, skipToNext, skipToPrevious } =
    usePlayer();
  const timerActive = useTimerStore((s) => s.isActive);
  const timerEndOfTrack = useTimerStore((s) => s.endOfTrack);
  const timerRemaining = useTimerStore((s) => s.remainingMs);

  // Fallback: use Zustand store as source of truth for current track
  // in case RNTP events don't fire (patched build issue)
  const storeTrack = usePlayerStore((s) => s.queue[s.currentIndex]);

  const track = activeTrack ?? (storeTrack ? {
    title: storeTrack.title,
    artist: storeTrack.artist,
    artwork: storeTrack.thumbnail,
    duration: storeTrack.duration,
  } : null);

  // Pulsing animation for playing indicator
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (isPlaying) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.3, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isPlaying]);

  if (!track) return null;

  const progressPct = progress.duration > 0
    ? (progress.position / progress.duration) * 100
    : 0;

  return (
    <TouchableOpacity
      style={styles.container}
      activeOpacity={0.95}
      onPress={() => router.push('/player')}
    >
      {/* Progress bar across the top */}
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${progressPct}%` } as any]} />
      </View>

      <View style={styles.content}>
        <View style={styles.artworkContainer}>
          <Image
            source={{ uri: track.artwork ?? undefined }}
            style={styles.artwork}
          />
          {isPlaying && (
            <Animated.View style={[styles.playingDot, { opacity: pulseAnim }]} />
          )}
        </View>
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={1}>
            {track.title ?? 'Unknown'}
          </Text>
          <Text style={styles.artist} numberOfLines={1}>
            {track.artist ?? 'Unknown artist'}
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
            skipToPrevious();
          }}
          style={styles.button}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="play-back" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={(e) => {
            e.stopPropagation();
            togglePlayback();
          }}
          style={styles.button}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons
            name={isBuffering ? 'hourglass' : isPlaying ? 'pause' : 'play'}
            size={26}
            color={colors.text}
          />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={(e) => {
            e.stopPropagation();
            skipToNext();
          }}
          style={styles.button}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="play-forward" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surfaceElevated,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    overflow: 'hidden',
    // Shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 12,
  },
  progressBar: {
    height: 2,
    backgroundColor: colors.border,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.sm + 2,
  },
  artworkContainer: {
    position: 'relative',
  },
  artwork: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  playingDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    borderWidth: 1.5,
    borderColor: colors.surfaceElevated,
  },
  info: {
    flex: 1,
    marginLeft: spacing.sm + 2,
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
