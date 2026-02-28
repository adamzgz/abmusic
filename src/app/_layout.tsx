import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import TrackPlayer, { Capability } from 'react-native-track-player';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';
import { startSleepTimerLoop, stopSleepTimerLoop } from '@/features/player/sleepTimer';
import { PoTokenProvider } from '@/features/potoken/PoTokenProvider';
import { useColors, useIsDark } from '@/theme/useColors';
import { preWarmInnertube } from '@/features/youtube/client';

export default function RootLayout() {
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const colors = useColors();
  const isDark = useIsDark();

  useEffect(() => {
    async function setupPlayer() {
      try {
        await TrackPlayer.setupPlayer({
          autoHandleInterruptions: true,
        });
        // Enable progress updates for crossfade monitoring
        await TrackPlayer.updateOptions({
          capabilities: [
            Capability.Play,
            Capability.Pause,
            Capability.SkipToNext,
            Capability.SkipToPrevious,
            Capability.SeekTo,
            Capability.Stop,
          ],
          progressUpdateEventInterval: 1,
        });
        setIsPlayerReady(true);
      } catch (error) {
        // Player already initialized (hot reload)
        setIsPlayerReady(true);
      }
    }
    setupPlayer();
    preWarmInnertube();
    startSleepTimerLoop();

    return () => {
      stopSleepTimerLoop();
    };
  }, []);

  const containerStyle = useMemo(
    () => ({ flex: 1, backgroundColor: colors.background }),
    [colors.background]
  );

  return (
    <GestureHandlerRootView style={containerStyle}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <PoTokenProvider />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="player"
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="playlist/[id]"
          options={{
            animation: 'slide_from_right',
          }}
        />
      </Stack>
    </GestureHandlerRootView>
  );
}
