import { useColorScheme } from 'react-native';
import { useSettingsStore } from '@/core/store/settingsStore';
import { getColors, type ColorPalette } from './colors';

export function useColors(): ColorPalette {
  const themeMode = useSettingsStore((s) => s.themeMode);
  const systemScheme = useColorScheme();

  if (themeMode === 'system') {
    return getColors(systemScheme === 'light' ? 'light' : 'dark');
  }

  return getColors(themeMode);
}

export function useIsDark(): boolean {
  const themeMode = useSettingsStore((s) => s.themeMode);
  const systemScheme = useColorScheme();

  if (themeMode === 'system') {
    return systemScheme !== 'light';
  }

  return themeMode === 'dark';
}
