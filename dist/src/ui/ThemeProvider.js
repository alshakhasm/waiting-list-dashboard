import { getTheme } from '../lib/design/tokens';
import { PreferenceService } from '../services/preferenceService';
export class ThemeManager {
    state;
    listeners = [];
    constructor() {
        const prefs = PreferenceService.get();
        this.state = {
            themeName: prefs.theme,
            fontSizePreset: prefs.fontSizePreset,
        };
    }
    getState() {
        return this.state;
    }
    getTokens() {
        return getTheme(this.state.themeName);
    }
    setThemeName(name) {
        this.state = { ...this.state, themeName: name };
        PreferenceService.set({ theme: name });
        this.emit();
    }
    setFontSizePreset(preset) {
        this.state = { ...this.state, fontSizePreset: preset };
        PreferenceService.set({ fontSizePreset: preset });
        this.emit();
    }
    subscribe(listener) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter((_l) => _l !== listener);
        };
    }
    emit() {
        for (const _listener of this.listeners)
            _listener(this.state);
    }
}
