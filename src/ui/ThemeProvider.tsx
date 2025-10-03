import type { ThemeName } from '../lib/design/tokens';
import { getTheme } from '../lib/design/tokens';
import { PreferenceService } from '../services/preferenceService';

export type ThemeState = {
  themeName: ThemeName;
  fontSizePreset: 'small' | 'medium' | 'large';
};

export class ThemeManager {
  private state: ThemeState;
  private listeners: Array<(s: ThemeState) => void> = [];

  constructor() {
    const prefs = PreferenceService.get();
    this.state = {
      themeName: prefs.theme,
      fontSizePreset: prefs.fontSizePreset,
    };
  }

  getState(): ThemeState {
    return this.state;
  }

  getTokens() {
    return getTheme(this.state.themeName);
  }

  setThemeName(name: ThemeName) {
    this.state = { ...this.state, themeName: name };
    PreferenceService.set({ theme: name });
    this.emit();
  }

  setFontSizePreset(preset: 'small' | 'medium' | 'large') {
    this.state = { ...this.state, fontSizePreset: preset };
    PreferenceService.set({ fontSizePreset: preset });
    this.emit();
  }

  subscribe(listener: (s: ThemeState) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private emit() {
    for (const l of this.listeners) l(this.state);
  }
}
