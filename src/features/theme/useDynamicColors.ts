import { useEffect, useState } from 'react';
import { getColors } from 'react-native-image-colors';
import { useColors } from '@/theme/useColors';

export interface ArtworkColors {
  dominant: string;
  darkVibrant: string;
  lightVibrant: string;
}

// In-memory cache keyed by image URL
const colorCache = new Map<string, ArtworkColors>();

export function useDynamicColors(imageUrl: string | undefined): ArtworkColors {
  const themeColors = useColors();

  const defaultColors: ArtworkColors = {
    dominant: themeColors.surface,
    darkVibrant: themeColors.surfaceVariant,
    lightVibrant: themeColors.primary,
  };

  const [artColors, setArtColors] = useState<ArtworkColors>(defaultColors);

  useEffect(() => {
    if (!imageUrl) {
      setArtColors(defaultColors);
      return;
    }

    const cached = colorCache.get(imageUrl);
    if (cached) {
      setArtColors(cached);
      return;
    }

    let cancelled = false;

    getColors(imageUrl, {
      fallback: themeColors.surface,
      cache: true,
      key: imageUrl,
    })
      .then((result) => {
        if (cancelled) return;

        let extracted: ArtworkColors;
        if (result.platform === 'android') {
          extracted = {
            dominant: result.dominant ?? themeColors.surface,
            darkVibrant: result.darkVibrant ?? themeColors.surfaceVariant,
            lightVibrant: result.lightVibrant ?? themeColors.primary,
          };
        } else if (result.platform === 'ios') {
          extracted = {
            dominant: result.primary ?? themeColors.surface,
            darkVibrant: result.detail ?? themeColors.surfaceVariant,
            lightVibrant: result.secondary ?? themeColors.primary,
          };
        } else {
          extracted = defaultColors;
        }

        colorCache.set(imageUrl, extracted);
        setArtColors(extracted);
      })
      .catch(() => {
        if (!cancelled) setArtColors(defaultColors);
      });

    return () => {
      cancelled = true;
    };
  }, [imageUrl, themeColors]);

  return artColors;
}
