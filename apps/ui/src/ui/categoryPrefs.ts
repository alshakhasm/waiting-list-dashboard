export type CategoryPref = {
  key: string; // built-in: 'dental'|'minorPath'...; custom: 'custom:<id>'
  label: string;
  color: string;
  hidden: boolean;
  // icon removed
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
    // sanitize: drop deprecated `icon` and unknown fields, keep only known shape
    let changed = false;
    const sanitized: CategoryPref[] = [];
    for (const p of parsed) {
      if (!p || typeof p.key !== 'string' || typeof p.label !== 'string' || typeof p.color !== 'string' || typeof p.hidden !== 'boolean') {
        continue;
      }
      const clean: CategoryPref = {
        key: p.key,
        label: p.label,
        color: p.color,
        hidden: p.hidden,
      };
      if (Array.isArray(p.keywords)) {
        const kw = p.keywords.filter((k: unknown) => typeof k === 'string' && k.trim() !== '');
        if (kw.length) clean.keywords = kw as string[];
      }
      if (p.builtIn === true) clean.builtIn = true;
      // detect if we need to persist sanitized data
      if ('icon' in p) changed = true;
      for (const k of Object.keys(p)) {
        if (!['key', 'label', 'color', 'hidden', 'keywords', 'builtIn'].includes(k)) {
          changed = true;
          break;
        }
      }
      sanitized.push(clean);
    }
    if (changed) saveCategoryPrefs(sanitized);
    return sanitized.length ? sanitized : defaults;
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
    { key: 'dental', label: 'Dental extraction', color: '#E6F4EA', hidden: false, builtIn: true },
    { key: 'minorPath', label: 'Minor pathology', color: '#E8F0FE', hidden: false, builtIn: true },
    { key: 'majorPath', label: 'Major pathology', color: '#FDE8E8', hidden: false, builtIn: true },
    { key: 'tmj', label: 'TMJ', color: '#EDE9FE', hidden: false, builtIn: true },
    { key: 'orthognathic', label: 'Orthognathic', color: '#FFF4E5', hidden: false, builtIn: true },
    { key: 'uncategorized', label: 'Uncategorized', color: '#F3F4F6', hidden: false, builtIn: true },
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
