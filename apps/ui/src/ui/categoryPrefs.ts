export type CategoryPref = {
  key: string; // built-in: 'dental'|'minorPath'...; custom: 'custom:<id>'
  label: string;
  color: string;
  hidden: boolean;
  icon?: string; // emoji or short text
  keywords?: string[]; // for custom categories only
  builtIn?: boolean;
};

const LS_KEY = 'category-prefs-v1';

export function loadCategoryPrefs(defaults: CategoryPref[]): CategoryPref[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return defaults;
    // shallow-validate
    return parsed.filter((p) => p && typeof p.key === 'string' && typeof p.label === 'string' && typeof p.color === 'string' && typeof p.hidden === 'boolean');
  } catch {
    return defaults;
  }
}

export function saveCategoryPrefs(prefs: CategoryPref[]) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(prefs)); } catch {}
}

export function defaultCategoryPrefs(): CategoryPref[] {
  // Defaults aligned with procedureGroups constants
  return [
    { key: 'dental', label: 'Dental extraction', color: '#E6F4EA', hidden: false, icon: '🦷', builtIn: true },
    { key: 'minorPath', label: 'Minor pathology', color: '#E8F0FE', hidden: false, icon: '🧪', builtIn: true },
    { key: 'majorPath', label: 'Major pathology', color: '#FDE8E8', hidden: false, icon: '🏥', builtIn: true },
    { key: 'tmj', label: 'TMJ', color: '#EDE9FE', hidden: false, icon: '🦴', builtIn: true },
    { key: 'orthognathic', label: 'Orthognathic', color: '#FFF4E5', hidden: false, icon: '🙂', builtIn: true },
    { key: 'uncategorized', label: 'Uncategorized', color: '#F3F4F6', hidden: false, icon: '📁', builtIn: true },
  ];
}

export function matchCustomCategory(text: string, prefs: CategoryPref[]): string | null {
  const t = text.toLowerCase();
  for (const p of prefs) {
    if (p.builtIn) continue;
    if (!p.keywords || p.keywords.length === 0) continue;
    for (const k of p.keywords) {
      if (!k) continue;
      if (t.includes(k.toLowerCase())) return p.key;
    }
  }
  return null;
}
