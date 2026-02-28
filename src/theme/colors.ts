// Material You dark theme palette
export const darkColors = {
  // Base
  background: '#0a0a0a',
  surface: '#1a1a1a',
  surfaceVariant: '#242424',
  surfaceElevated: '#2a2a2a',

  // Primary accent
  primary: '#bb86fc',
  primaryVariant: '#9c64e8',
  onPrimary: '#000000',

  // Text
  text: '#e8e8e8',
  textSecondary: '#a0a0a0',
  textTertiary: '#666666',

  // UI
  border: '#333333',
  divider: '#1f1f1f',
  overlay: 'rgba(0, 0, 0, 0.6)',

  // Semantic
  error: '#cf6679',
  success: '#81c784',
  warning: '#ffb74d',
} as const;

// Material You light theme palette
export const lightColors = {
  // Base
  background: '#f5f5f5',
  surface: '#ffffff',
  surfaceVariant: '#f0f0f0',
  surfaceElevated: '#ffffff',

  // Primary accent
  primary: '#7c4dff',
  primaryVariant: '#651fff',
  onPrimary: '#ffffff',

  // Text
  text: '#1a1a1a',
  textSecondary: '#666666',
  textTertiary: '#999999',

  // UI
  border: '#e0e0e0',
  divider: '#eeeeee',
  overlay: 'rgba(0, 0, 0, 0.3)',

  // Semantic
  error: '#d32f2f',
  success: '#388e3c',
  warning: '#f57c00',
} as const;

export type ColorPalette = {
  readonly background: string;
  readonly surface: string;
  readonly surfaceVariant: string;
  readonly surfaceElevated: string;
  readonly primary: string;
  readonly primaryVariant: string;
  readonly onPrimary: string;
  readonly text: string;
  readonly textSecondary: string;
  readonly textTertiary: string;
  readonly border: string;
  readonly divider: string;
  readonly overlay: string;
  readonly error: string;
  readonly success: string;
  readonly warning: string;
};

export function getColors(mode: 'light' | 'dark'): ColorPalette {
  return mode === 'light' ? lightColors : darkColors;
}

// Default export for backward compatibility during migration
export const colors = darkColors;
