import { TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { FullPlayer } from '@/features/player/FullPlayer';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';

export default function PlayerScreen() {
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  closeBtn: {
    alignSelf: 'center',
    padding: spacing.sm,
  },
});
