import { useEffect, useState } from 'react';
import { getColors } from 'react-native-image-colors';
import { colors as themeColors } from '@/theme/colors';

export interface ArtworkColors {
  dominant: string;
  darkVibrant: string;
  lightVibrant: string;
}

const DEFAULT_COLORS: ArtworkColors = {
  dominant: themeColors.surface,
  darkVibrant: themeColors.surfaceVariant,
  lightVibrant: themeColors.primary,
};

// In-memory cache keyed by image URL
const colorCache = new Map<string, ArtworkColors>();

export function useDynamicColors(imageUrl: string | undefined): ArtworkColors {
  const [artColors, setArtColors] = useState<ArtworkColors>(DEFAULT_COLORS);

  useEffect(() => {
    if (!imageUrl) {
      setArtColors(DEFAULT_COLORS);
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
          extracted = DEFAULT_COLORS;
        }

        colorCache.set(imageUrl, extracted);
        setArtColors(extracted);
      })
      .catch(() => {
        if (!cancelled) setArtColors(DEFAULT_COLORS);
      });

    return () => {
      cancelled = true;
    };
  }, [imageUrl]);

  return artColors;
}
