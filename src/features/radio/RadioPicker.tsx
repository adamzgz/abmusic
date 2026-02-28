import { useMemo } from 'react';
import { Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/theme/useColors';
import { spacing } from '@/theme/spacing';
import type { ColorPalette } from '@/theme/colors';

export type RadioType = 'artist' | 'genre' | 'discovery' | 'mix';

const OPTIONS: { type: RadioType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { type: 'artist', label: 'Artist', icon: 'person' },
  { type: 'genre', label: 'Genre', icon: 'musical-notes' },
  { type: 'discovery', label: 'Discovery', icon: 'compass' },
  { type: 'mix', label: 'Mix', icon: 'shuffle' },
];

interface Props {
  selected: RadioType;
  onSelect: (type: RadioType) => void;
}

export function RadioPicker({ selected, onSelect }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {OPTIONS.map((opt) => (
        <TouchableOpacity
          key={opt.type}
          style={[styles.chip, selected === opt.type && styles.chipActive]}
          onPress={() => onSelect(opt.type)}
          activeOpacity={0.7}
        >
          <Ionicons
            name={opt.icon}
            size={14}
            color={selected === opt.type ? colors.onPrimary : colors.textSecondary}
          />
          <Text
            style={[
              styles.chipText,
              selected === opt.type && styles.chipTextActive,
            ]}
          >
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const createStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    container: {
      paddingHorizontal: spacing.lg,
      gap: spacing.sm,
      paddingVertical: spacing.xs,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: 20,
      backgroundColor: colors.surface,
    },
    chipActive: {
      backgroundColor: colors.primary,
    },
    chipText: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: '600',
    },
    chipTextActive: {
      color: colors.onPrimary,
    },
  });
