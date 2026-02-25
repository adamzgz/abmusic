import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTimerStore } from '@/core/store/timerStore';
import { formatRemaining } from '@/features/player/sleepTimer';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';

const PRESETS = [
  { label: '15 min', ms: 15 * 60 * 1000 },
  { label: '30 min', ms: 30 * 60 * 1000 },
  { label: '45 min', ms: 45 * 60 * 1000 },
  { label: '60 min', ms: 60 * 60 * 1000 },
  { label: '90 min', ms: 90 * 60 * 1000 },
];

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function SleepTimerSheet({ visible, onClose }: Props) {
  const { isActive, endOfTrack, remainingMs, startTimer, startEndOfTrack, cancel } =
    useTimerStore();

  const onPreset = (ms: number) => {
    startTimer(ms);
    onClose();
  };

  const onEndOfTrack = () => {
    startEndOfTrack();
    onClose();
  };

  const onCancel = () => {
    cancel();
    onClose();
  };

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
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>Sleep Timer</Text>

          {isActive && (
            <View style={styles.activeRow}>
              <Ionicons name="moon" size={18} color={colors.primary} />
              <Text style={styles.activeText}>
                {endOfTrack
                  ? 'Stopping after current track'
                  : `${formatRemaining(remainingMs)} remaining`}
              </Text>
              <TouchableOpacity onPress={onCancel} style={styles.cancelBtn}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}

          {PRESETS.map((p) => (
            <TouchableOpacity
              key={p.ms}
              style={styles.option}
              onPress={() => onPreset(p.ms)}
            >
              <Ionicons name="time-outline" size={20} color={colors.text} />
              <Text style={styles.optionText}>{p.label}</Text>
            </TouchableOpacity>
          ))}

          <TouchableOpacity style={styles.option} onPress={onEndOfTrack}>
            <Ionicons name="musical-note-outline" size={20} color={colors.text} />
            <Text style={styles.optionText}>End of track</Text>
          </TouchableOpacity>
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
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.surfaceVariant,
    alignSelf: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  activeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceVariant,
    padding: spacing.md,
    borderRadius: 12,
    marginBottom: spacing.md,
  },
  activeText: {
    flex: 1,
    color: colors.primary,
    fontSize: 14,
    fontWeight: '500',
  },
  cancelBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },
  cancelText: {
    color: colors.error,
    fontSize: 13,
    fontWeight: '600',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.divider,
  },
  optionText: {
    color: colors.text,
    fontSize: 16,
  },
});
