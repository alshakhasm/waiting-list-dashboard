export type Palette = {
  background: string;
  surface: string;
  text: string;
  mutedText: string;
  accent: string;
  success: string;
  warning: string;
  danger: string;
  focusOutline: string;
};

export type ThemeTokens = {
  name: 'default' | 'high-contrast';
  palette: Palette;
  typography: {
    baseFontSizePx: number; // default preset
    lineHeight: number;
    scaleRatio: number; // modular scale
  };
};

export const themes: Record<'default' | 'high-contrast', ThemeTokens> = {
  default: {
    name: 'default',
    palette: {
      background: '#0f111a',
      surface: '#161821',
      text: '#e6e6e6',
      mutedText: '#a0a3ad',
      accent: '#7aa2f7',
      success: '#9ece6a',
      warning: '#e0af68',
      danger: '#f7768e',
      focusOutline: '#c0caf5',
    },
    typography: {
      baseFontSizePx: 14,
      lineHeight: 1.5,
      scaleRatio: 1.2,
    },
  },
  'high-contrast': {
    name: 'high-contrast',
    palette: {
      background: '#000000',
      surface: '#0a0a0a',
      text: '#ffffff',
      mutedText: '#e0e0e0',
      accent: '#00baff',
      success: '#37ff8b',
      warning: '#ffd166',
      danger: '#ff4d6d',
      focusOutline: '#ffffff',
    },
    typography: {
      baseFontSizePx: 16,
      lineHeight: 1.6,
      scaleRatio: 1.2,
    },
  },
};

export type ThemeName = keyof typeof themes;

export function getTheme(name: ThemeName): ThemeTokens {
  return themes[name];
}
