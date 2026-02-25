import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useSearchStore } from '@/core/store/searchStore';
import { usePlayerStore } from '@/core/store/playerStore';
import { searchMusic, getSearchSuggestions } from '@/features/youtube/search';
import { playTrack } from '@/features/player/playTrack';
import { TrackItem } from '@/components/TrackItem';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import type { MusicTrack } from '@/features/youtube/types';

export default function SearchScreen() {
  const {
    query,
    results,
    suggestions,
    isLoading,
    error,
    setQuery,
    setResults,
    setSuggestions,
    setLoading,
    setError,
    clear,
  } = useSearchStore();

  const currentTrackId = usePlayerStore((s) => s.queue[s.currentIndex]?.id);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<TextInput>(null);

  // Debounced suggestions
  const onChangeText = useCallback(
    (text: string) => {
      setQuery(text);
      setShowSuggestions(true);

      if (debounceRef.current) clearTimeout(debounceRef.current);

      if (text.length < 2) {
        setSuggestions([]);
        return;
      }

      debounceRef.current = setTimeout(async () => {
        try {
          const sug = await getSearchSuggestions(text);
          setSuggestions(sug);
        } catch {
          // Ignore suggestion errors
        }
      }, 300);
    },
    [setQuery, setSuggestions],
  );

  // Execute search
  const executeSearch = useCallback(
    async (searchQuery: string) => {
      if (!searchQuery.trim()) return;

      Keyboard.dismiss();
      setShowSuggestions(false);
      setQuery(searchQuery);
      setLoading(true);

      try {
        const res = await searchMusic(searchQuery);
        setResults(res.tracks);
      } catch (err: any) {
        setError(err.message ?? 'Search failed');
      } finally {
        setLoading(false);
      }
    },
    [setQuery, setLoading, setResults, setError],
  );

  // Handle track press — ref-guarded to prevent double-tap firing multiple plays
  const isPlayingRef = useRef(false);
  const onTrackPress = useCallback(async (track: MusicTrack) => {
    if (isPlayingRef.current) return;
    isPlayingRef.current = true;
    try {
      await playTrack(track);
    } catch (err: any) {
      setError(`Playback failed: ${err.message}`);
    } finally {
      isPlayingRef.current = false;
    }
  }, [setError]);

  // Handle suggestion tap
  const onSuggestionPress = useCallback(
    (suggestion: string) => {
      executeSearch(suggestion);
    },
    [executeSearch],
  );

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Search bar */}
      <View style={styles.searchBar}>
        <Ionicons
          name="search"
          size={20}
          color={colors.textSecondary}
          style={styles.searchIcon}
        />
        <TextInput
          ref={inputRef}
          style={styles.input}
          placeholder="Search songs, artists..."
          placeholderTextColor={colors.textTertiary}
          value={query}
          onChangeText={onChangeText}
          onSubmitEditing={() => executeSearch(query)}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
        />
        {query.length > 0 && (
          <TouchableOpacity
            onPress={() => {
              clear();
              setShowSuggestions(false);
              inputRef.current?.focus();
            }}
            style={styles.clearBtn}
          >
            <Ionicons name="close-circle" size={20} color={colors.textTertiary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <View style={styles.suggestionsContainer}>
          {suggestions.slice(0, 6).map((s, i) => (
            <TouchableOpacity
              key={`${s}-${i}`}
              style={styles.suggestionItem}
              onPress={() => onSuggestionPress(s)}
            >
              <Ionicons
                name="search-outline"
                size={16}
                color={colors.textSecondary}
              />
              <Text style={styles.suggestionText} numberOfLines={1}>
                {s}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Error */}
      {error && (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={18} color={colors.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Loading */}
      {isLoading && (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Searching...</Text>
        </View>
      )}

      {/* Results */}
      {!isLoading && results.length > 0 && (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TrackItem
              track={item}
              onPress={onTrackPress}
              isPlaying={item.id === currentTrackId}
            />
          )}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
        />
      )}

      {/* Empty state */}
      {!isLoading && !error && results.length === 0 && query.length === 0 && (
        <View style={styles.centered}>
          <Ionicons
            name="musical-notes"
            size={64}
            color={colors.surfaceVariant}
          />
          <Text style={styles.emptyTitle}>Search for music</Text>
          <Text style={styles.emptySubtitle}>
            Find songs, artists, and albums
          </Text>
        </View>
      )}

      {/* No results */}
      {!isLoading && !error && results.length === 0 && query.length > 0 && !showSuggestions && (
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>No results</Text>
          <Text style={styles.emptySubtitle}>
            Try a different search term
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceVariant,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    borderRadius: 12,
    paddingHorizontal: spacing.sm,
    height: 48,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
    paddingVertical: 0,
  },
  clearBtn: {
    padding: spacing.xs,
  },
  suggestionsContainer: {
    marginHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    gap: spacing.sm,
  },
  suggestionText: {
    color: colors.text,
    fontSize: 14,
    flex: 1,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.sm,
    backgroundColor: 'rgba(207, 102, 121, 0.1)',
    borderRadius: 8,
  },
  errorText: {
    color: colors.error,
    fontSize: 13,
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: 14,
    marginTop: spacing.sm,
  },
  listContent: {
    paddingBottom: 80, // Space for MiniPlayer
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  emptySubtitle: {
    ...typography.bodySmall,
    color: colors.textTertiary,
  },
});
