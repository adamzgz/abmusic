import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { usePlayerStore } from '@/core/store/playerStore';
import { getHistory, type HistoryEntry } from '@/features/library/history';
import { playTrack, playTracks } from '@/features/player/playTrack';
import { getRadioTracks } from '@/features/youtube/radio';
import { startRadio } from '@/features/radio/engine';
import { artistRadio } from '@/features/radio/strategies/artistRadio';
import { genreRadio } from '@/features/radio/strategies/genreRadio';
import { discoveryRadio } from '@/features/radio/strategies/discoveryRadio';
import { mixRadio } from '@/features/radio/strategies/mixRadio';
import { RadioPicker, type RadioType } from '@/features/radio/RadioPicker';
import { TrackItem } from '@/components/TrackItem';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import type { MusicTrack } from '@/features/youtube/types';

export default function HomeScreen() {
  const [recentHistory, setRecentHistory] = useState<HistoryEntry[]>([]);
  const [isLoadingRadio, setIsLoadingRadio] = useState(false);
  const [radioType, setRadioType] = useState<RadioType>('artist');
  const [genreInput, setGenreInput] = useState('');
  const currentTrackId = usePlayerStore((s) => s.queue[s.currentIndex]?.id);

  // Load recent history on mount
  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const history = await getHistory(20);
      setRecentHistory(history);
    } catch {
      // Ignore on first load
    }
  };

  // Start radio from a track (strategy depends on radioType)
  const onStartRadio = useCallback(
    async (track: MusicTrack) => {
      setIsLoadingRadio(true);
      try {
        let radioTracks: MusicTrack[] = [];

        switch (radioType) {
          case 'artist':
            radioTracks = await getRadioTracks(track.id);
            startRadio(artistRadio, track.id);
            break;
          case 'genre': {
            const genre = genreInput.trim() || track.artist;
            radioTracks = await genreRadio.generateTracks(genre);
            startRadio(genreRadio, genre);
            break;
          }
          case 'discovery':
            radioTracks = await discoveryRadio.generateTracks(
              `${track.artist}|||${track.title}`
            );
            startRadio(discoveryRadio, `${track.artist}|||${track.title}`);
            break;
          case 'mix':
            radioTracks = await mixRadio.generateTracks(
              `${track.id}|||${track.artist}|||${track.title}`
            );
            startRadio(mixRadio, `${track.id}|||${track.artist}|||${track.title}`);
            break;
        }

        if (radioTracks.length > 0) {
          usePlayerStore.getState().setRadioMode(true);
          await playTracks([track, ...radioTracks], 0);
        } else {
          await playTrack(track);
        }
      } catch {
        await playTrack(track);
      } finally {
        setIsLoadingRadio(false);
      }
    },
    [radioType, genreInput]
  );

  const onTrackPress = useCallback(async (track: MusicTrack) => {
    try {
      await playTrack(track);
    } catch {
      // Ignore
    }
  }, []);

  // Get unique recent tracks (deduplicated by id)
  const recentTracks = recentHistory.reduce<MusicTrack[]>((acc, entry) => {
    if (!acc.find((t) => t.id === entry.track.id)) {
      acc.push(entry.track);
    }
    return acc;
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>SonicFlow</Text>
      </View>

      <FlatList
        data={[]}
        renderItem={null}
        ListHeaderComponent={
          <>
            {/* Radio type picker */}
            <View style={styles.radioSection}>
              <Text style={styles.sectionTitle}>Radio Mode</Text>
              <RadioPicker selected={radioType} onSelect={setRadioType} />
              {radioType === 'genre' && (
                <TextInput
                  style={styles.genreInput}
                  placeholder="Enter genre (e.g., lo-fi, rock, jazz)..."
                  placeholderTextColor={colors.textTertiary}
                  value={genreInput}
                  onChangeText={setGenreInput}
                />
              )}
            </View>

            {/* Quick actions */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Quick Start</Text>
              <View style={styles.quickActions}>
                {recentTracks.slice(0, 4).map((track) => (
                  <TouchableOpacity
                    key={track.id}
                    style={styles.quickCard}
                    onPress={() => onStartRadio(track)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="radio" size={18} color={colors.primary} />
                    <Text style={styles.quickTitle} numberOfLines={1}>
                      {track.title}
                    </Text>
                    <Text style={styles.quickArtist} numberOfLines={1}>
                      {track.artist}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {recentTracks.length === 0 && (
                <View style={styles.emptyQuick}>
                  <Ionicons name="radio-outline" size={32} color={colors.surfaceVariant} />
                  <Text style={styles.emptyText}>
                    Search and play songs to see quick radio here
                  </Text>
                </View>
              )}
            </View>

            {/* Loading radio indicator */}
            {isLoadingRadio && (
              <View style={styles.radioLoading}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.radioLoadingText}>Starting radio...</Text>
              </View>
            )}

            {/* Recent history */}
            {recentTracks.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Recently Played</Text>
              </View>
            )}
          </>
        }
        ListFooterComponent={
          recentTracks.length > 0 ? (
            <View style={styles.recentList}>
              {recentTracks.map((track) => (
                <TrackItem
                  key={track.id}
                  track={track}
                  onPress={onTrackPress}
                  isPlaying={track.id === currentTrackId}
                />
              ))}
            </View>
          ) : null
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
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  title: {
    ...typography.h1,
    color: colors.text,
  },
  radioSection: {
    marginBottom: spacing.md,
  },
  section: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  genreInput: {
    backgroundColor: colors.surfaceVariant,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    fontSize: 14,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
  },
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  quickCard: {
    backgroundColor: colors.surfaceVariant,
    borderRadius: 10,
    padding: spacing.md,
    width: '47%',
    gap: 4,
  },
  quickTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  quickArtist: {
    color: colors.textSecondary,
    fontSize: 11,
  },
  emptyQuick: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  emptyText: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  radioLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  radioLoadingText: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  recentList: {
    paddingBottom: spacing.xl,
  },
  listContent: {
    paddingBottom: 80,
  },
});
