export type UIPreferences = {
  theme: 'default' | 'high-contrast';
  fontSizePreset: 'small' | 'medium' | 'large';
};

let store: Partial<UIPreferences> = {};

export const PreferenceService = {
  get(): UIPreferences {
    return {
      theme: (store.theme ?? 'default'),
      fontSizePreset: (store.fontSizePreset ?? 'medium'),
    };
  },
  set(prefs: Partial<UIPreferences>) {
    store = { ...store, ...prefs };
  },
  _reset() {
    store = {};
  },
};
