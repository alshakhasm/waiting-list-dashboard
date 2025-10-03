let store = {};
export const PreferenceService = {
    get() {
        return {
            theme: (store.theme ?? 'default'),
            fontSizePreset: (store.fontSizePreset ?? 'medium'),
        };
    },
    set(prefs) {
        store = { ...store, ...prefs };
    },
    _reset() {
        store = {};
    },
};
