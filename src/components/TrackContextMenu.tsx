import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Image,
  FlatList,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { addFavorite, removeFavorite, isFavorite } from '@/features/library/favorites';
import {
  getPlaylists,
  addTrackToPlaylist,
  type Playlist,
} from '@/features/library/playlists';
import { usePlayerStore } from '@/core/store/playerStore';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import type { MusicTrack } from '@/features/youtube/types';

interface TrackContextMenuProps {
  track: MusicTrack | null;
  visible: boolean;
  onClose: () => void;
}

export function TrackContextMenu({ track, visible, onClose }: TrackContextMenuProps) {
  const [isFav, setIsFav] = useState(false);
  const [showPlaylists, setShowPlaylists] = useState(false);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const addToQueue = usePlayerStore((s) => s.addToQueue);

  useEffect(() => {
    if (visible && track) {
      isFavorite(track.id).then(setIsFav);
    }
    if (!visible) {
      setShowPlaylists(false);
    }
  }, [visible, track]);

  const onToggleFavorite = useCallback(async () => {
    if (!track) return;
    if (isFav) {
      await removeFavorite(track.id);
    } else {
      await addFavorite(track);
    }
    setIsFav(!isFav);
    onClose();
  }, [track, isFav, onClose]);

  const onAddToQueue = useCallback(() => {
    if (!track) return;
    addToQueue([track]);
    onClose();
  }, [track, addToQueue, onClose]);

  const onShowPlaylists = useCallback(async () => {
    const pl = await getPlaylists();
    setPlaylists(pl);
    setShowPlaylists(true);
  }, []);

  const onAddToPlaylist = useCallback(
    async (playlistId: string) => {
      if (!track) return;
      await addTrackToPlaylist(playlistId, track);
      setShowPlaylists(false);
      onClose();
    },
    [track, onClose],
  );

  if (!track) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.sheet} onStartShouldSetResponder={() => true}>
          {/* Drag handle */}
          <View style={styles.handleContainer}>
            <View style={styles.handle} />
          </View>
          {/* Track info header */}
          <View style={styles.trackHeader}>
            <Image source={{ uri: track.thumbnail }} style={styles.thumbnail} />
            <View style={styles.trackInfo}>
              <Text style={styles.trackTitle} numberOfLines={1}>
                {track.title}
              </Text>
              <Text style={styles.trackArtist} numberOfLines={1}>
                {track.artist}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          {showPlaylists ? (
            <>
              <Text style={styles.playlistHeader}>Add to playlist</Text>
              <FlatList
                data={playlists}
                keyExtractor={(item) => item.id}
                style={styles.playlistList}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.playlistRow}
                    onPress={() => onAddToPlaylist(item.id)}
                  >
                    <Ionicons
                      name="musical-notes"
                      size={20}
                      color={colors.primary}
                    />
                    <Text style={styles.playlistName}>{item.name}</Text>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <Text style={styles.emptyText}>No playlists yet</Text>
                }
              />
            </>
          ) : (
            <>
              {/* Favorite */}
              <TouchableOpacity style={styles.menuItem} onPress={onToggleFavorite}>
                <Ionicons
                  name={isFav ? 'heart' : 'heart-outline'}
                  size={22}
                  color={isFav ? colors.error : colors.text}
                />
                <Text style={styles.menuText}>
                  {isFav ? 'Remove from Favorites' : 'Add to Favorites'}
                </Text>
              </TouchableOpacity>

              {/* Add to queue */}
              <TouchableOpacity style={styles.menuItem} onPress={onAddToQueue}>
                <Ionicons name="list" size={22} color={colors.text} />
                <Text style={styles.menuText}>Add to Queue</Text>
              </TouchableOpacity>

              {/* Add to playlist */}
              <TouchableOpacity style={styles.menuItem} onPress={onShowPlaylists}>
                <Ionicons name="add-circle-outline" size={22} color={colors.text} />
                <Text style={styles.menuText}>Add to Playlist</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surfaceElevated,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
    maxHeight: '60%',
  },
  handleContainer: {
    alignItems: 'center',
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.textTertiary,
  },
  trackHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.md,
  },
  thumbnail: {
    width: 48,
    height: 48,
    borderRadius: 6,
    backgroundColor: colors.surface,
  },
  trackInfo: {
    flex: 1,
  },
  trackTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  trackArtist: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  divider: {
    height: 0.5,
    backgroundColor: colors.border,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
  },
  menuText: {
    color: colors.text,
    fontSize: 15,
  },
  playlistHeader: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  playlistList: {
    maxHeight: 200,
  },
  playlistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
  },
  playlistName: {
    color: colors.text,
    fontSize: 15,
  },
  emptyText: {
    color: colors.textTertiary,
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
});
