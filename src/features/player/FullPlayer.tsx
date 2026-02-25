import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePlayer } from './usePlayer';
import { LyricsView } from './LyricsView';
import { useDynamicColors } from '@/features/theme/useDynamicColors';
import { DynamicBackground } from '@/features/theme/DynamicBackground';
import { SleepTimerSheet } from '@/components/SleepTimerSheet';
import { useTimerStore } from '@/core/store/timerStore';
import { formatRemaining } from './sleepTimer';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { formatTime } from '@/core/utils/formatTime';

type PlayerView = 'artwork' | 'lyrics';

// Full-screen player view with large artwork, progress bar, and controls.
export function FullPlayer() {
  const {
    activeTrack,
    isPlaying,
    isBuffering,
    progress,
    togglePlayback,
    skipToNext,
    skipToPrevious,
    seekTo,
  } = usePlayer();

  const [currentView, setCurrentView] = useState<PlayerView>('artwork');
  const [showTimerSheet, setShowTimerSheet] = useState(false);
  const artworkColors = useDynamicColors(activeTrack?.artwork ?? undefined);
  const timerActive = useTimerStore((s) => s.isActive);
  const timerEndOfTrack = useTimerStore((s) => s.endOfTrack);
  const timerRemaining = useTimerStore((s) => s.remainingMs);

  if (!activeTrack) return null;

  return (
    <View style={styles.container}>
      <DynamicBackground artworkColors={artworkColors} />

      {/* Header bar with timer + lyrics toggle */}
      <View style={styles.headerBar}>
        {/* Sleep timer */}
        <TouchableOpacity
          onPress={() => setShowTimerSheet(true)}
          style={styles.headerBtn}
        >
          <Ionicons
            name={timerActive ? 'moon' : 'moon-outline'}
            size={22}
            color={timerActive ? colors.primary : colors.textSecondary}
          />
          {timerActive && !timerEndOfTrack && (
            <Text style={styles.timerBadge}>
              {formatRemaining(timerRemaining)}
            </Text>
          )}
          {timerActive && timerEndOfTrack && (
            <Text style={styles.timerBadge}>1x</Text>
          )}
        </TouchableOpacity>

        <View style={styles.headerSpacer} />

        {/* Lyrics toggle */}
        <TouchableOpacity
          onPress={() =>
            setCurrentView((v) => (v === 'artwork' ? 'lyrics' : 'artwork'))
          }
          style={styles.headerBtn}
        >
          <Ionicons
            name="text"
            size={22}
            color={currentView === 'lyrics' ? colors.primary : colors.textSecondary}
          />
        </TouchableOpacity>
      </View>

      {/* Main content: artwork or lyrics */}
      {currentView === 'artwork' ? (
        <Image
          source={{ uri: activeTrack.artwork ?? undefined }}
          style={styles.artwork}
        />
      ) : (
        <View style={styles.lyricsContainer}>
          <LyricsView
            title={activeTrack.title ?? undefined}
            artist={activeTrack.artist ?? undefined}
            duration={activeTrack.duration}
          />
        </View>
      )}

      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={2}>
          {activeTrack.title ?? 'Unknown'}
        </Text>
        <Text style={styles.artist} numberOfLines={1}>
          {activeTrack.artist ?? 'Unknown artist'}
        </Text>
      </View>

      {/* Progress */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              {
                width:
                  progress.duration > 0
                    ? `${(progress.position / progress.duration) * 100}%`
                    : '0%',
              },
            ]}
          />
        </View>
        <View style={styles.timeRow}>
          <Text style={styles.time}>{formatTime(progress.position)}</Text>
          <Text style={styles.time}>{formatTime(progress.duration)}</Text>
        </View>
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity onPress={skipToPrevious} style={styles.controlBtn}>
          <Ionicons name="play-skip-back" size={32} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity onPress={togglePlayback} style={styles.playBtn}>
          <Ionicons
            name={isBuffering ? 'hourglass' : isPlaying ? 'pause' : 'play'}
            size={36}
            color={colors.onPrimary}
          />
        </TouchableOpacity>
        <TouchableOpacity onPress={skipToNext} style={styles.controlBtn}>
          <Ionicons name="play-skip-forward" size={32} color={colors.text} />
        </TouchableOpacity>
      </View>

      <SleepTimerSheet
        visible={showTimerSheet}
        onClose={() => setShowTimerSheet(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  headerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: spacing.xs,
  },
  headerSpacer: {
    flex: 1,
  },
  timerBadge: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  artwork: {
    width: 280,
    height: 280,
    borderRadius: 12,
    backgroundColor: colors.surface,
    marginBottom: spacing.xl,
  },
  lyricsContainer: {
    width: '100%',
    height: 280,
    marginBottom: spacing.xl,
  },
  info: {
    alignItems: 'center',
    marginBottom: spacing.lg,
    width: '100%',
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  artist: {
    color: colors.textSecondary,
    fontSize: 16,
    marginTop: spacing.xs,
  },
  progressContainer: {
    width: '100%',
    marginBottom: spacing.lg,
  },
  progressBar: {
    height: 3,
    backgroundColor: colors.surfaceVariant,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  time: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xl,
  },
  controlBtn: {
    padding: spacing.sm,
  },
  playBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
