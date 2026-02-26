import { useState, useEffect, useCallback } from 'react';
import { TouchableOpacity, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
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

const CIRCLE_SIZE = 22;
const STROKE_WIDTH = 2.5;
const RADIUS = (CIRCLE_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function DownloadButton({ track }: Props) {
  const [status, setStatus] = useState<'none' | 'downloading' | 'downloaded'>('none');
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (isActivelyDownloading(track.id)) {
      setStatus('downloading');
    } else {
      isDownloaded(track.id).then((yes) => {
        setStatus(yes ? 'downloaded' : 'none');
      });
    }

    const unsub = onDownloadProgress(track.id, (p) => {
      if (p.status === 'complete') {
        setStatus('downloaded');
        setProgress(0);
      } else if (p.status === 'downloading') {
        setStatus('downloading');
        setProgress(p.progress);
      } else {
        setStatus('none');
        setProgress(0);
      }
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
      setProgress(0);
      try {
        await downloadTrack(track);
      } catch {
        setStatus('none');
        setProgress(0);
      }
    }
  }, [status, track]);

  return (
    <TouchableOpacity style={styles.btn} onPress={onPress} activeOpacity={0.6}>
      {status === 'downloading' ? (
        <View style={styles.progressContainer}>
          <Svg width={CIRCLE_SIZE} height={CIRCLE_SIZE}>
            {/* Background circle */}
            <Circle
              cx={CIRCLE_SIZE / 2}
              cy={CIRCLE_SIZE / 2}
              r={RADIUS}
              stroke={colors.surfaceVariant}
              strokeWidth={STROKE_WIDTH}
              fill="none"
            />
            {/* Progress arc */}
            <Circle
              cx={CIRCLE_SIZE / 2}
              cy={CIRCLE_SIZE / 2}
              r={RADIUS}
              stroke={colors.primary}
              strokeWidth={STROKE_WIDTH}
              fill="none"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
              strokeLinecap="round"
              rotation={-90}
              origin={`${CIRCLE_SIZE / 2}, ${CIRCLE_SIZE / 2}`}
            />
          </Svg>
        </View>
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
  progressContainer: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
