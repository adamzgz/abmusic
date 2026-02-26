import { useEffect, useState, useCallback } from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { addFavorite, removeFavorite, isFavorite } from '@/features/library/favorites';
import { colors } from '@/theme/colors';
import type { MusicTrack } from '@/features/youtube/types';

interface FavoriteButtonProps {
  track: MusicTrack;
  size?: number;
}

export function FavoriteButton({ track, size = 22 }: FavoriteButtonProps) {
  const [isFav, setIsFav] = useState(false);

  useEffect(() => {
    isFavorite(track.id).then(setIsFav);
  }, [track.id]);

  const onToggle = useCallback(async () => {
    if (isFav) {
      await removeFavorite(track.id);
      setIsFav(false);
    } else {
      await addFavorite(track);
      setIsFav(true);
    }
  }, [track, isFav]);

  return (
    <TouchableOpacity onPress={onToggle} style={styles.btn} hitSlop={8}>
      <Ionicons
        name={isFav ? 'heart' : 'heart-outline'}
        size={size}
        color={isFav ? colors.error : colors.textSecondary}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    padding: 4,
  },
});
