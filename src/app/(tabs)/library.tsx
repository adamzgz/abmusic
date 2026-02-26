import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { usePlayerStore } from '@/core/store/playerStore';
import { getFavorites } from '@/features/library/favorites';
import { getHistory, clearHistory, type HistoryEntry } from '@/features/library/history';
import {
  getPlaylists,
  createPlaylist,
  deletePlaylist,
  type Playlist,
} from '@/features/library/playlists';
import { getAllCachedAudio, getCacheSize, cachedToTrack, type CachedAudio } from '@/features/cache/offlineDb';
import { deleteDownload } from '@/features/cache/offlineCache';
import { playTrack } from '@/features/player/playTrack';
import { TrackItem } from '@/components/TrackItem';
import { TrackContextMenu } from '@/components/TrackContextMenu';
import { ImportPlaylistSheet } from '@/components/ImportPlaylistSheet';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import type { MusicTrack } from '@/features/youtube/types';

type Tab = 'favorites' | 'playlists' | 'history' | 'downloads';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export default function LibraryScreen() {
  const [activeTab, setActiveTab] = useState<Tab>('favorites');
  const [favorites, setFavorites] = useState<MusicTrack[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [downloads, setDownloads] = useState<CachedAudio[]>([]);
  const [cacheSize, setCacheSize] = useState(0);
  const [showNewPlaylist, setShowNewPlaylist] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [contextTrack, setContextTrack] = useState<MusicTrack | null>(null);
  const currentTrackId = usePlayerStore((s) => s.queue[s.currentIndex]?.id);

  const loadData = useCallback(async () => {
    try {
      if (activeTab === 'favorites') {
        setFavorites(await getFavorites());
      } else if (activeTab === 'playlists') {
        setPlaylists(await getPlaylists());
      } else if (activeTab === 'history') {
        setHistory(await getHistory(50));
      } else if (activeTab === 'downloads') {
        setDownloads(await getAllCachedAudio());
        setCacheSize(await getCacheSize());
      }
    } catch {
      // Ignore load errors
    }
  }, [activeTab]);

  // Reload data when tab comes into focus (e.g. after adding a favorite elsewhere)
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onTrackPress = useCallback(async (track: MusicTrack) => {
    try {
      await playTrack(track);
    } catch {
      // Ignore
    }
  }, []);

  const onCreatePlaylist = useCallback(async () => {
    const name = newPlaylistName.trim();
    if (!name) return;
    await createPlaylist(name);
    setNewPlaylistName('');
    setShowNewPlaylist(false);
    loadData();
  }, [newPlaylistName, loadData]);

  const onDeletePlaylist = useCallback(
    (playlist: Playlist) => {
      Alert.alert('Delete Playlist', `Delete "${playlist.name}"?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deletePlaylist(playlist.id);
            loadData();
          },
        },
      ]);
    },
    [loadData],
  );

  const onDeleteDownload = useCallback(
    (cached: CachedAudio) => {
      Alert.alert('Remove Download', `Remove "${cached.title}"?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await deleteDownload(cached.trackId);
            loadData();
          },
        },
      ]);
    },
    [loadData],
  );

  const onClearHistory = useCallback(() => {
    Alert.alert('Clear History', 'Remove all play history?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          await clearHistory();
          loadData();
        },
      },
    ]);
  }, [loadData]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Library</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {(['favorites', 'playlists', 'history', 'downloads'] as Tab[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === tab && styles.tabTextActive,
              ]}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Favorites tab */}
      {activeTab === 'favorites' && (
        <FlatList
          data={favorites}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TrackItem
              track={item}
              onPress={onTrackPress}
              onLongPress={setContextTrack}
              isPlaying={item.id === currentTrackId}
            />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="heart-outline" size={48} color={colors.surfaceVariant} />
              <Text style={styles.emptyTitle}>No favorites yet</Text>
              <Text style={styles.emptySubtitle}>
                Songs you like will appear here
              </Text>
            </View>
          }
          contentContainerStyle={styles.listContent}
        />
      )}

      {/* Playlists tab */}
      {activeTab === 'playlists' && (
        <FlatList
          data={playlists}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.playlistItem}
              activeOpacity={0.7}
              onPress={() =>
                router.push({
                  pathname: '/playlist/[id]',
                  params: { id: item.id, name: item.name },
                })
              }
            >
              <View style={styles.playlistIcon}>
                <Ionicons name="musical-notes" size={20} color={colors.primary} />
              </View>
              <View style={styles.playlistInfo}>
                <Text style={styles.playlistName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.playlistMeta}>
                  {item.trackCount} {item.trackCount === 1 ? 'song' : 'songs'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => onDeletePlaylist(item)}
                style={styles.deleteBtn}
              >
                <Ionicons name="trash-outline" size={18} color={colors.textTertiary} />
              </TouchableOpacity>
            </TouchableOpacity>
          )}
          ListHeaderComponent={
            <>
              {/* Import + New playlist row */}
              <View style={styles.playlistActionsRow}>
                {showNewPlaylist ? (
                  <View style={styles.newPlaylistRow}>
                    <TextInput
                      style={styles.newPlaylistInput}
                      placeholder="Playlist name..."
                      placeholderTextColor={colors.textTertiary}
                      value={newPlaylistName}
                      onChangeText={setNewPlaylistName}
                      onSubmitEditing={onCreatePlaylist}
                      autoFocus
                    />
                    <TouchableOpacity onPress={onCreatePlaylist}>
                      <Ionicons name="checkmark-circle" size={28} color={colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setShowNewPlaylist(false)}>
                      <Ionicons name="close-circle" size={28} color={colors.textTertiary} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.playlistBtnRow}>
                    <TouchableOpacity
                      style={styles.newPlaylistBtn}
                      onPress={() => setShowNewPlaylist(true)}
                    >
                      <Ionicons name="add-circle" size={22} color={colors.primary} />
                      <Text style={styles.newPlaylistText}>New Playlist</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.importBtn}
                      onPress={() => setShowImport(true)}
                    >
                      <Ionicons name="cloud-download-outline" size={20} color={colors.primary} />
                      <Text style={styles.newPlaylistText}>Import</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </>
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="list-outline" size={48} color={colors.surfaceVariant} />
              <Text style={styles.emptyTitle}>No playlists</Text>
              <Text style={styles.emptySubtitle}>
                Create a playlist to organize your music
              </Text>
            </View>
          }
          contentContainerStyle={styles.listContent}
        />
      )}

      {/* History tab */}
      {activeTab === 'history' && (
        <FlatList
          data={history}
          keyExtractor={(item, index) => `${item.track.id}-${index}`}
          renderItem={({ item }) => (
            <TrackItem
              track={item.track}
              onPress={onTrackPress}
              onLongPress={setContextTrack}
              isPlaying={item.track.id === currentTrackId}
            />
          )}
          ListHeaderComponent={
            history.length > 0 ? (
              <TouchableOpacity style={styles.clearBtn} onPress={onClearHistory}>
                <Ionicons name="trash-outline" size={16} color={colors.error} />
                <Text style={styles.clearText}>Clear history</Text>
              </TouchableOpacity>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="time-outline" size={48} color={colors.surfaceVariant} />
              <Text style={styles.emptyTitle}>No history</Text>
              <Text style={styles.emptySubtitle}>
                Songs you play will appear here
              </Text>
            </View>
          }
          contentContainerStyle={styles.listContent}
        />
      )}

      {/* Downloads tab */}
      {activeTab === 'downloads' && (
        <FlatList
          data={downloads}
          keyExtractor={(item) => item.trackId}
          renderItem={({ item }) => (
            <View style={styles.downloadRow}>
              <View style={styles.downloadTrack}>
                <TrackItem
                  track={cachedToTrack(item)}
                  onPress={onTrackPress}
                  isPlaying={item.trackId === currentTrackId}
                />
              </View>
              <TouchableOpacity
                onPress={() => onDeleteDownload(item)}
                style={styles.deleteBtn}
              >
                <Ionicons name="trash-outline" size={18} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>
          )}
          ListHeaderComponent={
            downloads.length > 0 ? (
              <View style={styles.cacheSizeRow}>
                <Ionicons name="folder-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.cacheSizeText}>
                  {downloads.length} songs · {formatBytes(cacheSize)}
                </Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="cloud-download-outline" size={48} color={colors.surfaceVariant} />
              <Text style={styles.emptyTitle}>No downloads</Text>
              <Text style={styles.emptySubtitle}>
                Downloaded songs for offline playback
              </Text>
            </View>
          }
          contentContainerStyle={styles.listContent}
        />
      )}

      <ImportPlaylistSheet
        visible={showImport}
        onClose={() => setShowImport(false)}
        onImported={loadData}
      />
      <TrackContextMenu
        track={contextTrack}
        visible={contextTrack !== null}
        onClose={() => setContextTrack(null)}
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
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  tab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    backgroundColor: colors.surface,
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  tabTextActive: {
    color: colors.onPrimary,
  },
  listContent: {
    paddingBottom: 120,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    gap: spacing.sm,
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
  playlistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  playlistIcon: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playlistInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  playlistName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '500',
  },
  playlistMeta: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  deleteBtn: {
    padding: spacing.sm,
  },
  playlistActionsRow: {
    paddingHorizontal: spacing.md,
  },
  playlistBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.md,
  },
  newPlaylistBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  importBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  newPlaylistText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '500',
  },
  newPlaylistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  newPlaylistInput: {
    flex: 1,
    backgroundColor: colors.surfaceVariant,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    fontSize: 14,
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignSelf: 'flex-end',
  },
  clearText: {
    color: colors.error,
    fontSize: 13,
  },
  downloadRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  downloadTrack: {
    flex: 1,
  },
  cacheSizeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  cacheSizeText: {
    color: colors.textSecondary,
    fontSize: 13,
  },
});
