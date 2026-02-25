import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';

interface ArtistCardProps {
  name: string;
  thumbnail: string;
  onPress: () => void;
}

export function ArtistCard({ name, thumbnail, onPress }: ArtistCardProps) {
  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.7}>
      <Image source={{ uri: thumbnail }} style={styles.image} />
      <Text style={styles.name} numberOfLines={1}>
        {name}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    width: 100,
    marginRight: spacing.md,
  },
  image: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.surface,
  },
  name: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '500',
    marginTop: spacing.sm,
    textAlign: 'center',
  },
});
