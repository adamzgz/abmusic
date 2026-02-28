import { useMemo } from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { FullPlayer } from '@/features/player/FullPlayer';
import { useColors } from '@/theme/useColors';
import { spacing } from '@/theme/spacing';
import type { ColorPalette } from '@/theme/colors';

export default function PlayerScreen() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity
        onPress={() => router.back()}
        style={styles.closeBtn}
      >
        <Ionicons name="chevron-down" size={28} color={colors.text} />
      </TouchableOpacity>
      <FullPlayer />
    </SafeAreaView>
  );
}

const createStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    closeBtn: {
      alignSelf: 'center',
      padding: spacing.sm,
    },
  });
