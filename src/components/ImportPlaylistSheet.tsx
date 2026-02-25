import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { importYouTubePlaylist, type ImportProgress } from '@/features/library/importPlaylist';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';

interface Props {
  visible: boolean;
  onClose: () => void;
  onImported: () => void;
}

export function ImportPlaylistSheet({ visible, onClose, onImported }: Props) {
  const [url, setUrl] = useState('');
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isImporting = progress !== null && progress.status !== 'done' && progress.status !== 'error';

  const onImport = async () => {
    if (!url.trim() || isImporting) return;
    setError(null);
    setProgress(null);

    try {
      await importYouTubePlaylist(url.trim(), setProgress);
      setUrl('');
      onImported();
      // Close after a short delay so user sees "done"
      setTimeout(onClose, 1200);
    } catch (err: any) {
      setError(err.message ?? 'Import failed');
      setProgress(null);
    }
  };

  const handleClose = () => {
    if (isImporting) return; // don't close during import
    setUrl('');
    setProgress(null);
    setError(null);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={handleClose}
      >
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>Import Playlist</Text>
          <Text style={styles.subtitle}>
            Paste a YouTube Music playlist URL
          </Text>

          <TextInput
            style={styles.input}
            placeholder="https://music.youtube.com/playlist?list=..."
            placeholderTextColor={colors.textTertiary}
            value={url}
            onChangeText={setUrl}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isImporting}
          />

          {error && (
            <View style={styles.errorRow}>
              <Ionicons name="alert-circle" size={16} color={colors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {progress && (
            <View style={styles.progressRow}>
              {progress.status === 'done' ? (
                <Ionicons name="checkmark-circle" size={18} color={colors.success} />
              ) : (
                <ActivityIndicator size="small" color={colors.primary} />
              )}
              <Text style={styles.progressText}>{progress.message}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.importBtn, (!url.trim() || isImporting) && styles.importBtnDisabled]}
            onPress={onImport}
            disabled={!url.trim() || isImporting}
          >
            <Text style={styles.importBtnText}>Import</Text>
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
    marginBottom: spacing.xs,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    marginBottom: spacing.md,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.text,
    fontSize: 14,
    marginBottom: spacing.md,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  errorText: {
    color: colors.error,
    fontSize: 13,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  progressText: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  importBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  importBtnDisabled: {
    opacity: 0.5,
  },
  importBtnText: {
    color: colors.onPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
});
