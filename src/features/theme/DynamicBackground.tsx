import { StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useEffect } from 'react';
import type { ArtworkColors } from './useDynamicColors';
import { colors as themeColors } from '@/theme/colors';

const AnimatedGradient = Animated.createAnimatedComponent(LinearGradient);

interface Props {
  artworkColors: ArtworkColors;
}

export function DynamicBackground({ artworkColors }: Props) {
  const opacity = useSharedValue(0);

  useEffect(() => {
    // Fade in when colors change
    opacity.value = 0;
    opacity.value = withTiming(1, { duration: 600 });
  }, [artworkColors.darkVibrant]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <AnimatedGradient
      colors={[artworkColors.darkVibrant, themeColors.background]}
      locations={[0, 0.85]}
      style={[StyleSheet.absoluteFillObject, animatedStyle]}
    />
  );
}
