import { useEffect, useMemo, useState } from 'react';
import { IconSearch } from './icons';
import { CategoryPref, defaultCategoryPrefs, loadCategoryPrefs, saveCategoryPrefs } from './categoryPrefs';
import { createBacklogItem } from '../client/api';

export function CategorySidebar({
  open = true,
  onChange,
  onAddedCase,
  onSearchChange,
}: {
  open?: boolean;
  onChange?: (_prefs: CategoryPref[]) => void;
  onAddedCase?: () => void;
  onSearchChange?: (q: string) => void;
}) {
  type Panel = 'add' | 'categories' | 'search' | null;
  const [expanded, setExpanded] = useState<boolean>(!!open);
  const [panel, setPanel] = useState<Panel>(open ? 'categories' : null);
  const [categoryPrefs, setPrefs] = useState<CategoryPref[]>(() => loadCategoryPrefs(defaultCategoryPrefs()));
  const [newLabel, setNewLabel] = useState('');
  const [newKeywords, setNewKeywords] = useState('');
  const [newColor, setNewColor] = useState('#e5e7eb');
  const [openColorKey, setOpenColorKey] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState<{ id: string; text: string } | null>(null);

  // Add Case form state
  const [adding, setAdding] = useState(false);
  const [caseName, setCaseName] = useState('');
  const [caseMrn, setCaseMrn] = useState('');
  const [caseProc, setCaseProc] = useState('');
  const [caseMinutes, setCaseMinutes] = useState(60);
  const [caseErr, setCaseErr] = useState<string | null>(null);
  const [caseTypeId, setCaseTypeId] = useState<'case:elective' | 'case:urgent' | 'case:emergency'>('case:elective');
  const [categoryKey, setCategoryKey] = useState<string>('dental');

  const presetColors = useMemo(() => {
    const base = defaultCategoryPrefs().map((p) => p.color);
    const extras = ['#E5E7EB', '#DBEAFE', '#FEF3C7', '#FEE2E2', '#DCFCE7', '#FAE8FF'];
    return Array.from(new Set([...base, ...extras]));
  }, []);

  useEffect(() => {
    saveCategoryPrefs(categoryPrefs);
    onChange?.(categoryPrefs);
    // Notify other components in this window that prefs changed so they can update without a full reload
    try {
      window.dispatchEvent(new CustomEvent('category-prefs-changed', { detail: categoryPrefs }));
    } catch {}
  }, [categoryPrefs, onChange]);

  const builtIns = useMemo(() => categoryPrefs.filter((p) => p.builtIn), [categoryPrefs]);
  const customs = useMemo(() => categoryPrefs.filter((p) => !p.builtIn), [categoryPrefs]);

  function toggleHidden(key: string) {
    setPrefs((prev) => prev.map((p) => (p.key === key ? { ...p, hidden: !p.hidden } : p)));
  }
  function moveUp(key: string) {
    setPrefs((prev) => {
      const i = prev.findIndex(p => p.key === key);
      if (i <= 0) return prev;
      const out = prev.slice();
      const tmp = out[i-1]; out[i-1] = out[i]; out[i] = tmp;
      return out;
    });
  }
  function moveDown(key: string) {
    setPrefs((prev) => {
      const i = prev.findIndex(p => p.key === key);
      if (i === -1 || i >= prev.length - 1) return prev;
      const out = prev.slice();
      const tmp = out[i+1]; out[i+1] = out[i]; out[i] = tmp;
      return out;
    });
  }
  function updateColor(key: string, color: string) {
    setPrefs((prev) => prev.map((p) => (p.key === key ? { ...p, color } : p)));
  }
  function removeCustom(key: string) {
    setPrefs((prev) => prev.filter((p) => p.key !== key));
  }
  function addCustom() {
    const label = newLabel.trim();
    if (!label) return;
    const id = 'custom:' + Math.random().toString(36).slice(2, 8);
    const keywords = newKeywords.split(',').map((s) => s.trim()).filter(Boolean);
    const next = { key: id, label, color: newColor, hidden: false, keywords };
    setPrefs((prev) => {
      const out = [...prev, next];
      try { console.debug('[CategorySidebar] added custom category', next, 'resultingPrefsLength:', out.length); } catch {}
      return out;
    });
    // Show a small toast confirming creation
    try {
      setToast({ id, text: `Category "${label}" added` });
      window.setTimeout(() => setToast(null), 3000);
    } catch {}
    setNewLabel('');
    setNewKeywords('');
    setNewColor('#e5e7eb');
  }

  return (
    <aside
      style={{
        width: expanded ? 260 : 48,
        transition: 'width 160ms ease',
        borderRight: '1px solid var(--border)',
  background: 'var(--surface-3)',
        minWidth: 0,
        maxHeight: 'calc(100vh - 64px)',
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', height: '100%' }}>
        {/* Vertical icon rail */}
        <div
          style={{
            width: 48,
            borderRight: expanded ? '1px solid var(--border)' : 'none',
            display: 'grid',
            gridAutoRows: 'min-content',
            alignContent: 'start',
            justifyItems: 'center',
            gap: 8,
            padding: 8,
            background: 'var(--surface-3)',
          }}
        >
          <button
            title={panel === 'search' && expanded ? 'Hide Search' : 'Show Search'}
            aria-label="Toggle Search"
            aria-pressed={panel === 'search'}
            onClick={() => {
              setOpenColorKey(null);
              if (!expanded) {
                setExpanded(true);
                setPanel('search');
                return;
              }
              if (panel === 'search') {
                setExpanded(false);
              } else {
                setPanel('search');
              }
            }}
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              border: '1px solid var(--border)',
              background: panel === 'search' ? 'var(--surface-1)' : 'transparent',
              cursor: 'pointer',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <IconSearch size={16} />
          </button>
          <button
            title={panel === 'add' && expanded ? 'Hide Add Case' : 'Show Add Case'}
            aria-label="Toggle Add Case"
            aria-pressed={panel === 'add'}
            onClick={() => {
              setOpenColorKey(null);
              if (!expanded) {
                setExpanded(true);
                setPanel('add');
                return;
              }
              if (panel === 'add') {
                // Collapse when clicking the active icon
                setExpanded(false);
              } else {
                // Switch panel and keep expanded
                setPanel('add');
              }
            }}
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              border: '1px solid var(--border)',
              background: panel === 'add' ? 'var(--surface-1)' : 'transparent',
              cursor: 'pointer',
            }}
          >
            +
          </button>
          <button
            title={panel === 'categories' && expanded ? 'Hide Categories' : 'Show Categories'}
            aria-label="Toggle Categories"
            aria-pressed={panel === 'categories'}
            onClick={() => {
              setOpenColorKey(null);
              if (!expanded) {
                setExpanded(true);
                setPanel('categories');
                return;
              }
              if (panel === 'categories') {
                // Collapse when clicking the active icon
                setExpanded(false);
              } else {
                // Switch panel and keep expanded
                setPanel('categories');
              }
            }}
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              border: '1px solid var(--border)',
              background: panel === 'categories' ? 'var(--surface-1)' : 'transparent',
              cursor: 'pointer',
            }}
          >
            ☰
          </button>
          <div
            aria-hidden="true"
            style={{
              width: '100%',
              height: 2,
              background: 'color-mix(in srgb, var(--border), black 40%)',
              margin: '8px 0',
            }}
          />
          {/* Chevron removed: panel icons now control expand/collapse */}
        </div>
        {/* Panel content */}
        <div style={{ flex: 1, minWidth: 0, overflow: 'auto', display: expanded ? 'block' : 'none', background: 'var(--surface-3)' }}>
          {/* Toast */}
          {toast && (
            <div style={{ position: 'absolute', right: 12, top: 12, zIndex: 60 }}>
              <div style={{ background: 'rgba(0,0,0,0.75)', color: '#fff', padding: '6px 10px', borderRadius: 6, fontSize: 13 }}>
                {toast.text}
              </div>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', padding: 8 }}>
            <strong style={{ fontSize: 13 }}>{panel === 'add' ? 'Quick Add Case' : panel === 'categories' ? 'Categories' : panel === 'search' ? 'Search' : ''}</strong>
          </div>
          {/* Search */}
          <div style={{ padding: 8, borderTop: '1px solid var(--border)', display: panel === 'search' ? 'grid' : 'none', gap: 8 }}>
            <input
              placeholder="Search name/procedure"
              value={search}
              onChange={(e) => {
                const q = e.target.value;
                setSearch(q);
                onSearchChange?.(q);
              }}
              style={{ height: 28, padding: '4px 8px', fontSize: 13 }}
            />
          </div>
          {/* Quick Add Case */}
          <div style={{ padding: 8, borderTop: '1px solid var(--border)', display: panel === 'add' ? 'grid' : 'none', gap: 8 }}>
            <strong style={{ fontSize: 11, opacity: 0.7 }}>Add a new case</strong>
            <input placeholder="Patient name" value={caseName} onChange={(e) => setCaseName(e.target.value)} style={{ height: 28, padding: '4px 8px', fontSize: 13 }} />
            <input placeholder="MRN (digits only)" value={caseMrn} onChange={(e) => setCaseMrn(e.target.value.replace(/\\D+/g, ''))} style={{ height: 28, padding: '4px 8px', fontSize: 13 }} />
            <input placeholder="Procedure" value={caseProc} onChange={(e) => setCaseProc(e.target.value)} style={{ height: 28, padding: '4px 8px', fontSize: 13 }} />
            <label style={{ display: 'grid', gap: 4 }}>
              <span style={{ fontSize: 11, opacity: 0.7 }}>Priority</span>
              <select value={caseTypeId} onChange={(e) => setCaseTypeId(e.target.value as any)} style={{ height: 28, padding: '4px 6px', fontSize: 13 }}>
                <option value="case:elective">Elective</option>
                <option value="case:urgent">Urgent</option>
                <option value="case:emergency">Emergency</option>
              </select>
            </label>
            <label style={{ display: 'grid', gap: 4 }}>
              <span style={{ fontSize: 11, opacity: 0.7 }}>Category</span>
              <select value={categoryKey} onChange={(e) => setCategoryKey(e.target.value)} style={{ height: 28, padding: '4px 6px', fontSize: 13 }}>
                {categoryPrefs.map((p) => (
                  <option key={p.key} value={p.key}>{p.label}</option>
                ))}
              </select>
            </label>
            <label style={{ display: 'grid', gap: 4 }}>
              <span style={{ fontSize: 11, opacity: 0.7 }}>Estimated minutes</span>
              <input type="number" min={0} step={5} placeholder="0" value={caseMinutes} onChange={(e) => setCaseMinutes(Math.max(0, parseInt(e.target.value || '0', 10)))} style={{ height: 28, padding: '4px 8px', fontSize: 13 }} />
            </label>
            {caseErr && (
              <div aria-live="polite" role="alert" style={{ color: '#a11', fontSize: 12 }}>{caseErr}</div>
            )}
            <button
              onClick={async () => {
                setCaseErr(null);
                if (!caseName.trim() || !caseMrn.trim() || !caseProc.trim()) {
                  setCaseErr('Please fill name, MRN and procedure.');
                  return;
                }
                setAdding(true);
                try {
                  await createBacklogItem({
                    patientName: caseName.trim(),
                    mrn: caseMrn.trim(),
                    procedure: caseProc.trim(),
                    estDurationMin: Math.max(0, caseMinutes),
                    caseTypeId,
                    categoryKey,
                  });
                  // Success: inform console which categoryKey we attempted to save
                  try { console.debug('[CategorySidebar] createBacklogItem succeeded, requested categoryKey:', categoryKey); } catch {}
                  setCaseName('');
                  setCaseMrn('');
                  setCaseProc('');
                  setCaseMinutes(60);
                  setCaseTypeId('case:elective');
                  setCategoryKey('dental');
                  onAddedCase?.();
                } catch (e: any) {
                  const msg = e?.message || String(e);
                  if (/row-level security|permission denied/i.test(msg)) {
                    setCaseErr('You are signed in but do not have permission to add cases. Ask an owner to approve your account.');
                  } else {
                    setCaseErr(msg);
                  }
                } finally {
                  setAdding(false);
                }
              }}
              disabled={adding}
              style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid var(--border)', cursor: 'pointer', height: 28 }}
            >
              {adding ? 'Adding…' : 'Add Case'}
            </button>
          </div>
          {/* Categories (built-ins) */}
          <div style={{ padding: 8, display: panel === 'categories' ? 'grid' : 'none', gap: 6 }}>
            {builtIns.map((p) => (
              <div key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 6, position: 'relative' }}>
                <span title={p.label} style={{ width: 12, height: 12, background: p.color, borderRadius: 3, display: 'inline-block', outline: '1px solid color-mix(in srgb, var(--border), black 25%)' }} />
                <span style={{ flex: 1, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.label}</span>
                <input
                  type="checkbox"
                  title="Hide category"
                  aria-label={`Hide ${p.label}`}
                  checked={p.hidden}
                  onChange={() => toggleHidden(p.key)}
                  style={{ width: 14, height: 14 }}
                />
                <button
                  onClick={() => setOpenColorKey((k) => (k === p.key ? null : p.key))}
                  aria-haspopup="true"
                  aria-expanded={openColorKey === p.key}
                  title={`Color for ${p.label}`}
                  style={{ width: 18, height: 18, border: '1px solid var(--border)', borderRadius: 4, background: p.color, cursor: 'pointer', padding: 0 }}
                />
                <div style={{ display: 'inline-flex', gap: 4, marginLeft: 6 }}>
                  <button title="Move up" onClick={() => moveUp(p.key)} style={{ padding: '2px 6px', borderRadius: 4, border: '1px solid var(--border)', cursor: 'pointer', height: 20 }}>
                    ↑
                  </button>
                  <button title="Move down" onClick={() => moveDown(p.key)} style={{ padding: '2px 6px', borderRadius: 4, border: '1px solid var(--border)', cursor: 'pointer', height: 20 }}>
                    ↓
                  </button>
                </div>
                {openColorKey === p.key && (
                  <div
                    data-color-popover
                    style={{ position: 'absolute', right: 0, top: 22, background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 6, padding: 6, zIndex: 40, boxShadow: '0 4px 10px var(--shadow)' }}
                  >
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 16px)', gap: 6 }}>
                      {presetColors.map((c) => (
                        <button
                          key={c}
                          title={c}
                          aria-label={`Pick ${c}`}
                          onClick={() => {
                            updateColor(p.key, c);
                            setOpenColorKey(null);
                          }}
                          style={{ width: 16, height: 16, background: c, border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', padding: 0 }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          {/* Custom categories */}
          <div style={{ padding: 8, borderTop: '1px solid var(--border)', display: panel === 'categories' ? 'grid' : 'none', gap: 6 }}>
            <strong style={{ fontSize: 11, opacity: 0.7 }}>Custom</strong>
            {customs.map((p) => (
              <div key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 6, position: 'relative' }}>
                <span title={p.label} style={{ width: 12, height: 12, background: p.color, borderRadius: 3, display: 'inline-block', outline: '1px solid color-mix(in srgb, var(--border), black 25%)' }} />
                <span style={{ flex: 1, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.label}</span>
                <input
                  type="checkbox"
                  title="Hide category"
                  aria-label={`Hide ${p.label}`}
                  checked={p.hidden}
                  onChange={() => toggleHidden(p.key)}
                  style={{ width: 14, height: 14 }}
                />
                <button
                  onClick={() => setOpenColorKey((k) => (k === p.key ? null : p.key))}
                  aria-haspopup="true"
                  aria-expanded={openColorKey === p.key}
                  title={`Color for ${p.label}`}
                  style={{ width: 18, height: 18, border: '1px solid var(--border)', borderRadius: 4, background: p.color, cursor: 'pointer', padding: 0 }}
                />
                <div style={{ display: 'inline-flex', gap: 4, marginLeft: 6 }}>
                  <button title="Move up" onClick={() => moveUp(p.key)} style={{ padding: '2px 6px', borderRadius: 4, border: '1px solid var(--border)', cursor: 'pointer', height: 20 }}>
                    ↑
                  </button>
                  <button title="Move down" onClick={() => moveDown(p.key)} style={{ padding: '2px 6px', borderRadius: 4, border: '1px solid var(--border)', cursor: 'pointer', height: 20 }}>
                    ↓
                  </button>
                </div>
                {openColorKey === p.key && (
                  <div
                    data-color-popover
                    style={{ position: 'absolute', right: 0, top: 22, background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 6, padding: 6, zIndex: 40, boxShadow: '0 4px 10px var(--shadow)' }}
                  >
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 16px)', gap: 6 }}>
                      {presetColors.map((c) => (
                        <button
                          key={c}
                          title={c}
                          aria-label={`Pick ${c}`}
                          onClick={() => {
                            updateColor(p.key, c);
                            setOpenColorKey(null);
                          }}
                          style={{ width: 16, height: 16, background: c, border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', padding: 0 }}
                        />
                      ))}
                    </div>
                  </div>
                )}
                <button onClick={() => removeCustom(p.key)} title="Remove" aria-label={`Remove ${p.label}`} style={{ background: 'transparent', border: '1px solid var(--border)', padding: '0 4px', borderRadius: 4, cursor: 'pointer', height: 20, lineHeight: 1 }}>×</button>
              </div>
            ))}
            <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
              <input placeholder="New category name" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} style={{ height: 28, padding: '4px 8px', fontSize: 13 }} />
              <input placeholder="Keywords (comma separated)" value={newKeywords} onChange={(e) => setNewKeywords(e.target.value)} style={{ height: 28, padding: '4px 8px', fontSize: 13 }} />
              <div style={{ display: 'flex', gap: 4, alignItems: 'center', position: 'relative' }}>
                <button
                  onClick={() => setOpenColorKey((k) => (k === 'new' ? null : 'new'))}
                  aria-haspopup="true"
                  aria-expanded={openColorKey === 'new'}
                  title="New category color"
                  style={{ width: 18, height: 18, border: '1px solid var(--border)', borderRadius: 4, background: newColor, cursor: 'pointer', padding: 0 }}
                />
                {openColorKey === 'new' && (
                  <div data-color-popover style={{ position: 'absolute', right: 0, top: 22, background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 6, padding: 6, zIndex: 40, boxShadow: '0 4px 10px var(--shadow)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 16px)', gap: 6 }}>
                      {presetColors.map((c) => (
                        <button
                          key={c}
                          title={c}
                          aria-label={`Pick ${c}`}
                          onClick={() => {
                            setNewColor(c);
                            setOpenColorKey(null);
                          }}
                          style={{ width: 16, height: 16, background: c, border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', padding: 0 }}
                        />
                      ))}
                    </div>
                  </div>
                )}
                <button onClick={addCustom} disabled={!newLabel.trim()} style={{ padding: '2px 6px', borderRadius: 4, border: '1px solid var(--border)', cursor: 'pointer', height: 28 }}>Add</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
