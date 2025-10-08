import type { ThemeName } from '../lib/design/tokens';
import { getTheme } from '../lib/design/tokens';
import { PreferenceService } from '../services/preferenceService';

export type ThemeState = {
  themeName: ThemeName;
  fontSizePreset: 'small' | 'medium' | 'large';
};

export class ThemeManager {
  private state: ThemeState;
  private listeners: Array<(_s: ThemeState) => void> = [];

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

  subscribe(listener: (_s: ThemeState) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((_l) => _l !== listener);
    };
  }

  private emit() {
    for (const _listener of this.listeners) _listener(this.state);
  }
}
