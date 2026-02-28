import {
  View,
  Text,
  TouchableOpacity,
  Switch,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useMemo } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useSettingsStore } from '@/core/store/settingsStore';
import type { ThemeMode } from '@/core/store/settingsStore';
import { useColors } from '@/theme/useColors';
import { typography } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import type { AudioQuality } from '@/features/youtube/types';

const QUALITY_OPTIONS: { value: AudioQuality; label: string; desc: string }[] = [
  { value: 'high', label: 'High', desc: 'Opus ~140kbps' },
  { value: 'low', label: 'Low', desc: 'Opus ~50kbps, saves data' },
];

const THEME_OPTIONS: { value: ThemeMode; label: string; desc: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'light', label: 'Light', desc: 'Always light theme', icon: 'sunny' },
  { value: 'dark', label: 'Dark', desc: 'Always dark theme', icon: 'moon' },
  { value: 'system', label: 'System', desc: 'Follow device setting', icon: 'phone-portrait-outline' },
];

export default function SettingsScreen() {
  const colors = useColors();
  const audioQuality = useSettingsStore((s) => s.audioQuality);
  const setAudioQuality = useSettingsStore((s) => s.setAudioQuality);
  const crossfadeDuration = useSettingsStore((s) => s.crossfadeDuration);
  const setCrossfadeDuration = useSettingsStore((s) => s.setCrossfadeDuration);
  const themeMode = useSettingsStore((s) => s.themeMode);
  const setThemeMode = useSettingsStore((s) => s.setThemeMode);
  const autoQueue = useSettingsStore((s) => s.autoQueue);
  const setAutoQueue = useSettingsStore((s) => s.setAutoQueue);

  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Appearance */}
        <Text style={styles.sectionTitle}>APPEARANCE</Text>
        <View style={styles.card}>
          {THEME_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={styles.optionRow}
              onPress={() => setThemeMode(opt.value)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={opt.icon}
                size={20}
                color={themeMode === opt.value ? colors.primary : colors.textSecondary}
                style={{ marginRight: spacing.sm }}
              />
              <View style={styles.optionInfo}>
                <Text style={styles.optionLabel}>{opt.label}</Text>
                <Text style={styles.optionDesc}>{opt.desc}</Text>
              </View>
              <View
                style={[
                  styles.radio,
                  themeMode === opt.value && styles.radioSelected,
                ]}
              >
                {themeMode === opt.value && (
                  <View style={styles.radioInner} />
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Audio Quality */}
        <Text style={styles.sectionTitle}>AUDIO QUALITY</Text>
        <View style={styles.card}>
          {QUALITY_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={styles.optionRow}
              onPress={() => setAudioQuality(opt.value)}
              activeOpacity={0.7}
            >
              <View style={styles.optionInfo}>
                <Text style={styles.optionLabel}>{opt.label}</Text>
                <Text style={styles.optionDesc}>{opt.desc}</Text>
              </View>
              <View
                style={[
                  styles.radio,
                  audioQuality === opt.value && styles.radioSelected,
                ]}
              >
                {audioQuality === opt.value && (
                  <View style={styles.radioInner} />
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Playback */}
        <Text style={styles.sectionTitle}>PLAYBACK</Text>
        <View style={styles.card}>
          <View style={styles.optionRow}>
            <View style={styles.optionInfo}>
              <Text style={styles.optionLabel}>Crossfade</Text>
              <Text style={styles.optionDesc}>
                {crossfadeDuration === 0
                  ? 'Off'
                  : `${crossfadeDuration}s between tracks`}
              </Text>
            </View>
            <View style={styles.stepperRow}>
              <TouchableOpacity
                onPress={() => setCrossfadeDuration(crossfadeDuration - 1)}
                style={styles.stepperBtn}
                disabled={crossfadeDuration <= 0}
              >
                <Ionicons
                  name="remove-circle-outline"
                  size={24}
                  color={crossfadeDuration <= 0 ? colors.textTertiary : colors.primary}
                />
              </TouchableOpacity>
              <Text style={styles.stepperValue}>{crossfadeDuration}s</Text>
              <TouchableOpacity
                onPress={() => setCrossfadeDuration(crossfadeDuration + 1)}
                style={styles.stepperBtn}
                disabled={crossfadeDuration >= 12}
              >
                <Ionicons
                  name="add-circle-outline"
                  size={24}
                  color={crossfadeDuration >= 12 ? colors.textTertiary : colors.primary}
                />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.optionRow}>
            <View style={styles.optionInfo}>
              <Text style={styles.optionLabel}>Autoplay</Text>
              <Text style={styles.optionDesc}>
                Play related songs when queue ends
              </Text>
            </View>
            <Switch
              value={autoQueue}
              onValueChange={setAutoQueue}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.text}
            />
          </View>
        </View>

        {/* About */}
        <Text style={styles.sectionTitle}>ABOUT</Text>
        <View style={styles.card}>
          <View style={styles.optionRow}>
            <View style={styles.optionInfo}>
              <Text style={styles.optionLabel}>ABMusic</Text>
              <Text style={styles.optionDesc}>Version 1.0.0</Text>
            </View>
            <Ionicons name="musical-notes" size={24} color={colors.primary} />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ReturnType<typeof import('@/theme/useColors').useColors>) =>
  StyleSheet.create({
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
    content: {
      paddingHorizontal: spacing.md,
      paddingBottom: 100,
    },
    sectionTitle: {
      ...typography.caption,
      color: colors.textTertiary,
      marginTop: spacing.lg,
      marginBottom: spacing.sm,
      marginLeft: spacing.xs,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      overflow: 'hidden',
    },
    optionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: 14,
      borderBottomWidth: 0.5,
      borderBottomColor: colors.border,
    },
    optionInfo: {
      flex: 1,
    },
    optionLabel: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '500',
    },
    optionDesc: {
      color: colors.textSecondary,
      fontSize: 12,
      marginTop: 2,
    },
    radio: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: colors.textTertiary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioSelected: {
      borderColor: colors.primary,
    },
    radioInner: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: colors.primary,
    },
    stepperRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    stepperBtn: {
      padding: 2,
    },
    stepperValue: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '600',
      minWidth: 28,
      textAlign: 'center',
    },
  });
