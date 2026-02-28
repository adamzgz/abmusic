import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  TextInput,
  Image,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { usePlayerStore } from '@/core/store/playerStore';
import { getHistory, type HistoryEntry } from '@/features/library/history';
import { playTrack, playTracks } from '@/features/player/playTrack';
import { router } from 'expo-router';
import { getRadioTracks } from '@/features/youtube/radio';
import { startRadio } from '@/features/radio/engine';
import { artistRadio } from '@/features/radio/strategies/artistRadio';
import { genreRadio } from '@/features/radio/strategies/genreRadio';
import { discoveryRadio } from '@/features/radio/strategies/discoveryRadio';
import { mixRadio } from '@/features/radio/strategies/mixRadio';
import { RadioPicker, type RadioType } from '@/features/radio/RadioPicker';
import { TrackItem } from '@/components/TrackItem';
import { TrackContextMenu } from '@/components/TrackContextMenu';
import {
  getHomeSections,
  getPlaylistTracks,
  type HomeSection,
  type HomeItem,
} from '@/features/youtube/home';
import { useColors } from '@/theme/useColors';
import { typography } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import type { MusicTrack } from '@/features/youtube/types';
import type { ColorPalette } from '@/theme/colors';

const GENRE_CHIPS = [
  'Rock', 'Pop', 'Hip Hop', 'Jazz', 'Lo-fi',
  'Electronic', 'R&B', 'Classical', 'Metal', 'Indie',
];

export default function HomeScreen() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [recentHistory, setRecentHistory] = useState<HistoryEntry[]>([]);
  const [homeSections, setHomeSections] = useState<HomeSection[]>([]);
  const [isLoadingHome, setIsLoadingHome] = useState(false);
  const [isLoadingRadio, setIsLoadingRadio] = useState(false);
  const [radioType, setRadioType] = useState<RadioType>('artist');
  const [genreInput, setGenreInput] = useState('');
  const [contextTrack, setContextTrack] = useState<MusicTrack | null>(null);
  const currentTrackId = usePlayerStore((s) => s.queue[s.currentIndex]?.id);

  // Load recent history and home sections on mount
  useEffect(() => {
    loadHistory();
    loadHomeSections();
  }, []);

  const loadHistory = async () => {
    try {
      const history = await getHistory(20);
      setRecentHistory(history);
    } catch {
      // Ignore on first load
    }
  };

  const loadHomeSections = async () => {
    setIsLoadingHome(true);
    try {
      const sections = await getHomeSections();
      setHomeSections(sections);
    } catch (e) {
      if (__DEV__) console.warn('[Home] Failed to load sections:', e);
    } finally {
      setIsLoadingHome(false);
    }
  };

  // Start radio from a track with a specific type
  const onStartRadio = useCallback(
    async (track: MusicTrack, type?: RadioType) => {
      const effectiveType = type ?? radioType;
      setIsLoadingRadio(true);
      try {
        let radioTracks: MusicTrack[] = [];

        switch (effectiveType) {
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

  // Handle tapping a home feed item (song, album, or playlist)
  const onHomeItemPress = useCallback(async (item: HomeItem) => {
    try {
      if (item.type === 'album') {
        // Navigate to album detail screen
        router.push({
          pathname: '/album/[id]',
          params: { id: item.id, title: item.title, thumbnail: item.thumbnail },
        });
      } else if (item.type === 'playlist') {
        const tracks = await getPlaylistTracks(item.id);
        if (tracks.length > 0) {
          await playTracks(tracks, 0);
        }
      } else {
        // Song — play directly
        await playTrack({
          id: item.id,
          title: item.title,
          artist: item.artist,
          duration: item.duration,
          thumbnail: item.thumbnail,
        });
      }
    } catch (e) {
      if (__DEV__) console.warn('[Home] item press failed:', e);
    }
  }, []);

  // Get unique recent tracks (deduplicated by id)
  const recentTracks = recentHistory.reduce<MusicTrack[]>((acc, entry) => {
    if (!acc.find((t) => t.id === entry.track.id)) {
      acc.push(entry.track);
    }
    return acc;
  }, []);

  // Pick a random seed track from history
  const getRandomSeed = useCallback((): MusicTrack | null => {
    if (recentTracks.length === 0) return null;
    return recentTracks[Math.floor(Math.random() * recentTracks.length)];
  }, [recentTracks]);

  // Start genre radio with a specific genre
  const onGenreChipPress = useCallback(
    async (genre: string) => {
      setIsLoadingRadio(true);
      setRadioType('genre');
      setGenreInput(genre);
      try {
        const tracks = await genreRadio.generateTracks(genre);
        startRadio(genreRadio, genre);
        if (tracks.length > 0) {
          usePlayerStore.getState().setRadioMode(true);
          await playTracks(tracks, 0);
        }
      } catch {
        // Ignore
      } finally {
        setIsLoadingRadio(false);
      }
    },
    []
  );

  // Handle radio type button press — immediately starts playback
  const onRadioButtonPress = useCallback(
    (type: RadioType) => {
      setRadioType(type);

      // Genre just shows chips, doesn't auto-start
      if (type === 'genre') return;

      const seed = getRandomSeed();
      if (!seed) {
        Alert.alert('No history yet', 'Search and play a song first to seed the radio.');
        return;
      }

      onStartRadio(seed, type);
    },
    [getRandomSeed, onStartRadio]
  );

  // Handle custom genre submit
  const onCustomGenreSubmit = useCallback(() => {
    const genre = genreInput.trim();
    if (!genre) return;
    onGenreChipPress(genre);
  }, [genreInput, onGenreChipPress]);

  // Time-based greeting
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.greeting}>{greeting}</Text>
        <Text style={styles.title}>ABMusic</Text>
      </View>

      <FlatList
        data={[]}
        renderItem={null}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            {/* Radio type picker */}
            <View style={styles.radioSection}>
              <Text style={styles.sectionTitle}>Radio Mode</Text>
              <RadioPicker selected={radioType} onSelect={onRadioButtonPress} />
              {radioType === 'genre' && (
                <>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.genreChipsRow}
                  >
                    {GENRE_CHIPS.map((genre) => (
                      <TouchableOpacity
                        key={genre}
                        style={[
                          styles.genreChip,
                          genreInput === genre && styles.genreChipActive,
                        ]}
                        onPress={() => onGenreChipPress(genre)}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.genreChipText,
                            genreInput === genre && styles.genreChipTextActive,
                          ]}
                        >
                          {genre}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                  <View style={styles.genreInputRow}>
                    <TextInput
                      style={styles.genreInput}
                      placeholder="Custom genre..."
                      placeholderTextColor={colors.textTertiary}
                      value={genreInput}
                      onChangeText={setGenreInput}
                      onSubmitEditing={onCustomGenreSubmit}
                      returnKeyType="go"
                    />
                    <TouchableOpacity
                      style={[styles.genreGoBtn, !genreInput.trim() && styles.genreGoBtnDisabled]}
                      onPress={onCustomGenreSubmit}
                      disabled={!genreInput.trim()}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="play" size={16} color={genreInput.trim() ? colors.onPrimary : colors.textTertiary} />
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>

            {/* Quick actions from history */}
            {recentTracks.length > 0 && (
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
                      <Image
                        source={{ uri: track.thumbnail }}
                        style={styles.quickThumb}
                      />
                      <View style={styles.quickInfo}>
                        <Text style={styles.quickTitle} numberOfLines={1}>
                          {track.title}
                        </Text>
                        <Text style={styles.quickArtist} numberOfLines={1}>
                          {track.artist}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Loading radio indicator */}
            {isLoadingRadio && (
              <View style={styles.radioLoading}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.radioLoadingText}>Starting radio...</Text>
              </View>
            )}

            {/* Trending / Recommendations sections */}
            {isLoadingHome && homeSections.length === 0 && (
              <View style={styles.homeLoading}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.radioLoadingText}>Loading recommendations...</Text>
              </View>
            )}

            {homeSections.map((section, idx) => (
              <View key={idx} style={styles.carouselSection}>
                <Text style={styles.carouselTitle}>{section.title}</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.carouselContent}
                >
                  {section.items.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.carouselCard}
                      onPress={() => onHomeItemPress(item)}
                      onLongPress={() =>
                        item.type === 'song'
                          ? setContextTrack({
                              id: item.id,
                              title: item.title,
                              artist: item.artist,
                              duration: item.duration,
                              thumbnail: item.thumbnail,
                            })
                          : undefined
                      }
                      activeOpacity={0.7}
                    >
                      <Image
                        source={{ uri: item.thumbnail }}
                        style={[
                          styles.carouselThumb,
                          item.type === 'album' && styles.carouselThumbAlbum,
                        ]}
                      />
                      <Text style={styles.carouselTrackTitle} numberOfLines={2}>
                        {item.title}
                      </Text>
                      <Text style={styles.carouselArtist} numberOfLines={1}>
                        {item.artist}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            ))}

            {/* Empty state — only if no history AND no home sections */}
            {recentTracks.length === 0 && homeSections.length === 0 && !isLoadingHome && (
              <View style={styles.section}>
                <View style={styles.emptyQuick}>
                  <Ionicons name="radio-outline" size={40} color={colors.textTertiary} />
                  <Text style={styles.emptyTitle}>Start listening</Text>
                  <Text style={styles.emptyText}>
                    Search for songs to build your radio
                  </Text>
                </View>
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
                  onLongPress={setContextTrack}
                  isPlaying={track.id === currentTrackId}
                />
              ))}
            </View>
          ) : null
        }
        contentContainerStyle={styles.listContent}
      />
      <TrackContextMenu
        track={contextTrack}
        visible={contextTrack !== null}
        onClose={() => setContextTrack(null)}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      paddingBottom: spacing.md,
    },
    greeting: {
      color: colors.textSecondary,
      fontSize: 14,
      fontWeight: '500',
      marginBottom: 2,
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
    genreChipsRow: {
      paddingHorizontal: spacing.lg,
      gap: spacing.xs,
      paddingVertical: spacing.sm,
    },
    genreChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs + 2,
      borderRadius: 16,
      backgroundColor: colors.surface,
    },
    genreChipActive: {
      backgroundColor: colors.primary,
    },
    genreChipText: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: '500',
    },
    genreChipTextActive: {
      color: colors.onPrimary,
    },
    genreInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: spacing.lg,
      marginTop: spacing.xs,
      gap: spacing.xs,
    },
    genreInput: {
      flex: 1,
      backgroundColor: colors.surfaceVariant,
      borderRadius: 10,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
      color: colors.text,
      fontSize: 14,
    },
    genreGoBtn: {
      backgroundColor: colors.primary,
      borderRadius: 10,
      padding: spacing.sm + 2,
    },
    genreGoBtnDisabled: {
      backgroundColor: colors.surface,
    },
    quickActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    quickCard: {
      backgroundColor: colors.surfaceVariant,
      borderRadius: 10,
      flexDirection: 'row',
      alignItems: 'center',
      width: '48%',
      overflow: 'hidden',
    },
    quickThumb: {
      width: 48,
      height: 48,
      backgroundColor: colors.surface,
    },
    quickInfo: {
      flex: 1,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
    },
    quickTitle: {
      color: colors.text,
      fontSize: 12,
      fontWeight: '600',
    },
    quickArtist: {
      color: colors.textSecondary,
      fontSize: 11,
      marginTop: 1,
    },
    emptyQuick: {
      alignItems: 'center',
      paddingVertical: spacing.xxl,
      gap: spacing.sm,
    },
    emptyTitle: {
      ...typography.h3,
      color: colors.textSecondary,
      marginTop: spacing.xs,
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
    homeLoading: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.xl,
    },
    radioLoadingText: {
      color: colors.textSecondary,
      fontSize: 13,
    },
    // Horizontal carousel sections for trending/recommendations
    carouselSection: {
      marginBottom: spacing.lg,
    },
    carouselTitle: {
      ...typography.h3,
      color: colors.text,
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.sm,
    },
    carouselContent: {
      paddingHorizontal: spacing.lg,
      gap: spacing.sm,
    },
    carouselCard: {
      width: 140,
    },
    carouselThumb: {
      width: 140,
      height: 140,
      borderRadius: 8,
      backgroundColor: colors.surface,
    },
    carouselThumbAlbum: {
      borderRadius: 4,
    },
    carouselTrackTitle: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '600',
      marginTop: spacing.xs,
      lineHeight: 17,
    },
    carouselArtist: {
      color: colors.textSecondary,
      fontSize: 12,
      marginTop: 2,
    },
    recentList: {
      paddingBottom: spacing.xl,
    },
    listContent: {
      paddingBottom: 120,
    },
  });
