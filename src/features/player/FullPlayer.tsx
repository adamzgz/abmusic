import { useState, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Dimensions,
  PanResponder,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePlayer } from './usePlayer';
import { LyricsView } from './LyricsView';
import { useDynamicColors } from '@/features/theme/useDynamicColors';
import { DynamicBackground } from '@/features/theme/DynamicBackground';
import { SleepTimerSheet } from '@/components/SleepTimerSheet';
import { FavoriteButton } from '@/components/FavoriteButton';
import { QueueView } from '@/components/QueueView';
import { useTimerStore } from '@/core/store/timerStore';
import { usePlayerStore } from '@/core/store/playerStore';
import { formatRemaining } from './sleepTimer';
import { useColors } from '@/theme/useColors';
import { spacing } from '@/theme/spacing';
import { formatTime } from '@/core/utils/formatTime';
import type { MusicTrack } from '@/features/youtube/types';
import type { ColorPalette } from '@/theme/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ARTWORK_SIZE = SCREEN_WIDTH - spacing.xl * 2;
const PROGRESS_BAR_WIDTH = SCREEN_WIDTH - spacing.xl * 2;

type PlayerView = 'artwork' | 'lyrics';

// Full-screen player view with large artwork, progress bar, and controls.
export function FullPlayer() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
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
  const [showQueue, setShowQueue] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekPosition, setSeekPosition] = useState(0);
  const shuffle = usePlayerStore((s) => s.shuffle);
  const repeatMode = usePlayerStore((s) => s.repeatMode);
  const setShuffle = usePlayerStore((s) => s.setShuffle);
  const setRepeatMode = usePlayerStore((s) => s.setRepeatMode);
  const artworkColors = useDynamicColors(activeTrack?.artwork ?? undefined);
  const timerActive = useTimerStore((s) => s.isActive);
  const timerEndOfTrack = useTimerStore((s) => s.endOfTrack);
  const timerRemaining = useTimerStore((s) => s.remainingMs);
  const progressBarRef = useRef<View>(null);

  const queue = usePlayerStore((s) => s.queue);
  const currentIndex = usePlayerStore((s) => s.currentIndex);

  // Use store track as fallback when RNTP events don't fire
  const storeTrack = queue[currentIndex];

  // Fallback display track from store
  const displayTrack = activeTrack ?? (storeTrack ? {
    id: storeTrack.id,
    title: storeTrack.title,
    artist: storeTrack.artist,
    artwork: storeTrack.thumbnail,
    duration: storeTrack.duration,
  } : null);

  // Build a MusicTrack for the FavoriteButton
  const currentTrack = useMemo((): MusicTrack | null => {
    if (storeTrack) return storeTrack;
    if (!displayTrack) return null;
    return {
      id: displayTrack.id ?? '',
      title: displayTrack.title ?? '',
      artist: displayTrack.artist ?? '',
      duration: displayTrack.duration ?? 0,
      thumbnail: displayTrack.artwork ?? '',
    };
  }, [displayTrack, storeTrack]);

  // Seekable progress bar via PanResponder
  const panResponder = useMemo(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        setIsSeeking(true);
        const x = evt.nativeEvent.locationX;
        const pct = Math.max(0, Math.min(1, x / PROGRESS_BAR_WIDTH));
        setSeekPosition(pct * progress.duration);
      },
      onPanResponderMove: (evt) => {
        const x = evt.nativeEvent.locationX;
        const pct = Math.max(0, Math.min(1, x / PROGRESS_BAR_WIDTH));
        setSeekPosition(pct * progress.duration);
      },
      onPanResponderRelease: () => {
        seekTo(seekPosition);
        setIsSeeking(false);
      },
    }),
  [progress.duration, seekPosition, seekTo]);

  const cycleRepeat = useCallback(() => {
    const next = repeatMode === 'off' ? 'all' : repeatMode === 'all' ? 'one' : 'off';
    setRepeatMode(next);
  }, [repeatMode, setRepeatMode]);

  if (!displayTrack) return null;

  const currentPosition = isSeeking ? seekPosition : progress.position;
  const progressPct = progress.duration > 0
    ? (currentPosition / progress.duration) * 100
    : 0;

  return (
    <View style={styles.container}>
      <DynamicBackground artworkColors={artworkColors} />

      {/* Header bar with timer + queue + lyrics toggle */}
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

        {/* Queue */}
        <TouchableOpacity
          onPress={() => setShowQueue(true)}
          style={styles.headerBtn}
        >
          <Ionicons name="list" size={22} color={colors.textSecondary} />
        </TouchableOpacity>

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
          source={{ uri: displayTrack.artwork ?? undefined }}
          style={[styles.artwork, { width: ARTWORK_SIZE, height: ARTWORK_SIZE }]}
        />
      ) : (
        <View style={[styles.lyricsContainer, { height: ARTWORK_SIZE }]}>
          <LyricsView
            title={displayTrack.title ?? undefined}
            artist={displayTrack.artist ?? undefined}
            duration={displayTrack.duration}
          />
        </View>
      )}

      {/* Track info + favorite */}
      <View style={styles.info}>
        <View style={styles.infoText}>
          <Text style={styles.title} numberOfLines={2}>
            {displayTrack.title ?? 'Unknown'}
          </Text>
          <Text style={styles.artist} numberOfLines={1}>
            {displayTrack.artist ?? 'Unknown artist'}
          </Text>
        </View>
        {currentTrack && <FavoriteButton track={currentTrack} size={28} />}
      </View>

      {/* Seekable progress bar */}
      <View style={styles.progressContainer}>
        <View
          ref={progressBarRef}
          style={styles.progressBarTouch}
          {...panResponder.panHandlers}
        >
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${progressPct}%` } as any,
              ]}
            />
          </View>
          {/* Seek thumb */}
          <View
            style={[
              styles.seekThumb,
              { left: `${progressPct}%` } as any,
              isSeeking && styles.seekThumbActive,
            ]}
          />
        </View>
        <View style={styles.timeRow}>
          <Text style={styles.time}>{formatTime(currentPosition)}</Text>
          <Text style={styles.time}>
            {progress.duration > 0 ? `-${formatTime(progress.duration - currentPosition)}` : '0:00'}
          </Text>
        </View>
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity onPress={() => setShuffle(!shuffle)} activeOpacity={0.7} style={styles.sideBtn}>
          <Ionicons
            name="shuffle"
            size={22}
            color={shuffle ? colors.primary : colors.textTertiary}
          />
        </TouchableOpacity>
        <TouchableOpacity onPress={skipToPrevious} style={styles.controlBtn}>
          <Ionicons name="play-skip-back" size={30} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity onPress={togglePlayback} style={styles.playBtn}>
          <Ionicons
            name={isBuffering ? 'hourglass' : isPlaying ? 'pause' : 'play'}
            size={36}
            color={colors.onPrimary}
          />
        </TouchableOpacity>
        <TouchableOpacity onPress={skipToNext} style={styles.controlBtn}>
          <Ionicons name="play-skip-forward" size={30} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity onPress={cycleRepeat} style={styles.sideBtn}>
          <Ionicons
            name="repeat"
            size={22}
            color={repeatMode !== 'off' ? colors.primary : colors.textTertiary}
          />
          {repeatMode === 'one' && <Text style={styles.repeatOne}>1</Text>}
        </TouchableOpacity>
      </View>

      <SleepTimerSheet
        visible={showTimerSheet}
        onClose={() => setShowTimerSheet(false)}
      />
      <QueueView
        visible={showQueue}
        onClose={() => setShowQueue(false)}
      />
    </View>
  );
}

const createStyles = (colors: ColorPalette) =>
  StyleSheet.create({
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
      marginBottom: spacing.sm,
    },
    headerBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      padding: spacing.sm,
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
      borderRadius: 16,
      backgroundColor: colors.surface,
      marginBottom: spacing.xl,
      // Shadow for album art
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.4,
      shadowRadius: 16,
      elevation: 10,
    },
    lyricsContainer: {
      width: '100%',
      marginBottom: spacing.xl,
    },
    info: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.md,
      width: '100%',
      gap: spacing.md,
    },
    infoText: {
      flex: 1,
    },
    title: {
      color: colors.text,
      fontSize: 22,
      fontWeight: '700',
      letterSpacing: -0.3,
    },
    artist: {
      color: colors.textSecondary,
      fontSize: 16,
      marginTop: spacing.xs,
    },
    progressContainer: {
      width: '100%',
      marginBottom: spacing.md,
    },
    progressBarTouch: {
      height: 24,
      justifyContent: 'center',
      position: 'relative',
    },
    progressBar: {
      height: 4,
      backgroundColor: 'rgba(255,255,255,0.15)',
      borderRadius: 2,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: colors.primary,
      borderRadius: 2,
    },
    seekThumb: {
      position: 'absolute',
      top: 8,
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.primary,
      marginLeft: -4,
    },
    seekThumbActive: {
      width: 14,
      height: 14,
      borderRadius: 7,
      top: 5,
      marginLeft: -7,
    },
    timeRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 2,
    },
    time: {
      color: colors.textSecondary,
      fontSize: 12,
      fontVariant: ['tabular-nums'],
    },
    controls: {
      flexDirection: 'row',
      alignItems: 'center',
      width: '100%',
      justifyContent: 'center',
      gap: spacing.lg,
    },
    sideBtn: {
      padding: spacing.sm,
      position: 'relative',
    },
    repeatOne: {
      position: 'absolute',
      bottom: 4,
      right: 4,
      fontSize: 8,
      fontWeight: '800',
      color: colors.primary,
    },
    controlBtn: {
      padding: spacing.sm,
    },
    playBtn: {
      width: 68,
      height: 68,
      borderRadius: 34,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      // Shadow for play button
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
  });
