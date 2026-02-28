import { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/theme/useColors';
import { spacing } from '@/theme/spacing';
import type { ColorPalette } from '@/theme/colors';

interface PlaylistCardProps {
  name: string;
  trackCount: number;
  onPress: () => void;
}

export function PlaylistCard({ name, trackCount, onPress }: PlaylistCardProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.icon}>
        <Ionicons name="musical-notes" size={24} color={colors.primary} />
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.count}>
          {trackCount} {trackCount === 1 ? 'track' : 'tracks'}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
    </TouchableOpacity>
  );
}

const createStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
    },
    icon: {
      width: 48,
      height: 48,
      borderRadius: 8,
      backgroundColor: colors.surfaceVariant,
      alignItems: 'center',
      justifyContent: 'center',
    },
    info: {
      flex: 1,
      marginLeft: spacing.md,
    },
    name: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '500',
    },
    count: {
      color: colors.textSecondary,
      fontSize: 13,
      marginTop: 2,
    },
  });
