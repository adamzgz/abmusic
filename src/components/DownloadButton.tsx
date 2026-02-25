import { useState, useEffect, useCallback } from 'react';
import { TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  downloadTrack,
  deleteDownload,
  isDownloaded,
  isActivelyDownloading,
  onDownloadProgress,
} from '@/features/cache/offlineCache';
import type { MusicTrack } from '@/features/youtube/types';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';

interface Props {
  track: MusicTrack;
}

export function DownloadButton({ track }: Props) {
  const [status, setStatus] = useState<'none' | 'downloading' | 'downloaded'>('none');

  useEffect(() => {
    // Check initial state
    if (isActivelyDownloading(track.id)) {
      setStatus('downloading');
    } else {
      isDownloaded(track.id).then((yes) => {
        setStatus(yes ? 'downloaded' : 'none');
      });
    }

    // Listen for progress
    const unsub = onDownloadProgress(track.id, (p) => {
      if (p.status === 'complete') setStatus('downloaded');
      else if (p.status === 'downloading') setStatus('downloading');
      else setStatus('none');
    });

    return () => { unsub(); };
  }, [track.id]);

  const onPress = useCallback(async () => {
    if (status === 'downloading') return;

    if (status === 'downloaded') {
      await deleteDownload(track.id);
      setStatus('none');
    } else {
      setStatus('downloading');
      try {
        await downloadTrack(track);
      } catch {
        setStatus('none');
      }
    }
  }, [status, track]);

  return (
    <TouchableOpacity style={styles.btn} onPress={onPress} activeOpacity={0.6}>
      {status === 'downloading' ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : (
        <Ionicons
          name={status === 'downloaded' ? 'cloud-done' : 'cloud-download-outline'}
          size={20}
          color={status === 'downloaded' ? colors.success : colors.textTertiary}
        />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    padding: spacing.xs,
    marginLeft: spacing.xs,
  },
});
