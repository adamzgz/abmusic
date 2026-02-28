import { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { useColors } from '@/theme/useColors';
import { spacing } from '@/theme/spacing';
import type { ColorPalette } from '@/theme/colors';

interface ArtistCardProps {
  name: string;
  thumbnail: string;
  onPress: () => void;
}

export function ArtistCard({ name, thumbnail, onPress }: ArtistCardProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.7}>
      <Image source={{ uri: thumbnail }} style={styles.image} />
      <Text style={styles.name} numberOfLines={1}>
        {name}
      </Text>
    </TouchableOpacity>
  );
}

const createStyles = (colors: ColorPalette) =>
  StyleSheet.create({
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
