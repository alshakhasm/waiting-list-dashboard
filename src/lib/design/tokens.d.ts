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
        baseFontSizePx: number;
        lineHeight: number;
        scaleRatio: number;
    };
};
export declare const themes: Record<'default' | 'high-contrast', ThemeTokens>;
export type ThemeName = keyof typeof themes;
export declare function getTheme(_name: ThemeName): ThemeTokens;
