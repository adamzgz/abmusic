import { useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import TrackPlayer from 'react-native-track-player';
import { useLyrics } from './useLyrics';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';

interface Props {
  title: string | undefined;
  artist: string | undefined;
  duration: number | undefined;
}

export function LyricsView({ title, artist, duration }: Props) {
  const { lyrics, activeLine, isLoading, error } = useLyrics(title, artist, duration);
  const scrollRef = useRef<ScrollView>(null);
  const linePositions = useRef<Map<number, number>>(new Map());

  // Auto-scroll to active line
  useEffect(() => {
    if (activeLine >= 0 && scrollRef.current) {
      const y = linePositions.current.get(activeLine);
      if (y !== undefined) {
        scrollRef.current.scrollTo({ y: Math.max(0, y - 120), animated: true });
      }
    }
  }, [activeLine]);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={styles.statusText}>Loading lyrics...</Text>
      </View>
    );
  }

  if (error || !lyrics) {
    return (
      <View style={styles.center}>
        <Text style={styles.statusText}>Lyrics not available</Text>
      </View>
    );
  }

  // Synced lyrics
  if (lyrics.hasSynced) {
    return (
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {lyrics.synced.map((line, i) => (
          <TouchableOpacity
            key={i}
            onPress={() => TrackPlayer.seekTo(line.time)}
            onLayout={(e) => {
              linePositions.current.set(i, e.nativeEvent.layout.y);
            }}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.lyricLine,
                i === activeLine && styles.activeLine,
                i < activeLine && styles.pastLine,
              ]}
            >
              {line.text || '♪'}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  }

  // Plain lyrics fallback
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.plainLyrics}>{lyrics.plain}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  statusText: {
    color: colors.textTertiary,
    fontSize: 14,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  lyricLine: {
    color: colors.textTertiary,
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 34,
    paddingVertical: spacing.xs,
  },
  activeLine: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
  },
  pastLine: {
    color: colors.textSecondary,
  },
  plainLyrics: {
    color: colors.textSecondary,
    fontSize: 16,
    lineHeight: 26,
  },
});
