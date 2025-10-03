import { useEffect, useMemo, useState } from 'react';
import { CategoryPref, defaultCategoryPrefs, loadCategoryPrefs, saveCategoryPrefs } from './categoryPrefs';

export function CategorySidebar({
  open = true,
  onChange,
}: {
  open?: boolean;
  onChange?: (prefs: CategoryPref[]) => void;
}) {
  const [expanded, setExpanded] = useState(open);
  const [prefs, setPrefs] = useState<CategoryPref[]>(() => loadCategoryPrefs(defaultCategoryPrefs()));
  const [newLabel, setNewLabel] = useState('');
  const [newKeywords, setNewKeywords] = useState('');
  const [newColor, setNewColor] = useState('#e5e7eb');
  const [newIcon, setNewIcon] = useState('📁');
  const [openColorKey, setOpenColorKey] = useState<string | null>(null);

  const presetColors = useMemo(() => {
    const base = defaultCategoryPrefs().map((p) => p.color);
    const extras = ['#E5E7EB', '#DBEAFE', '#FEF3C7', '#FEE2E2', '#DCFCE7', '#FAE8FF'];
    return Array.from(new Set([...base, ...extras]));
  }, []);

  useEffect(() => { saveCategoryPrefs(prefs); onChange?.(prefs); }, [prefs]);

  const builtIns = useMemo(() => prefs.filter(p => p.builtIn), [prefs]);
  const customs = useMemo(() => prefs.filter(p => !p.builtIn), [prefs]);

  function toggleHidden(key: string) {
    setPrefs(prev => prev.map(p => p.key === key ? { ...p, hidden: !p.hidden } : p));
  }
  function updateColor(key: string, color: string) {
    setPrefs(prev => prev.map(p => p.key === key ? { ...p, color } : p));
  }
  function removeCustom(key: string) {
    setPrefs(prev => prev.filter(p => p.key !== key));
  }
  function addCustom() {
    const label = newLabel.trim();
    if (!label) return;
    const id = 'custom:' + Math.random().toString(36).slice(2, 8);
    const keywords = newKeywords.split(',').map(s => s.trim()).filter(Boolean);
    setPrefs(prev => [...prev, { key: id, label, color: newColor, hidden: false, icon: newIcon || '📁', keywords }]);
    setNewLabel(''); setNewKeywords(''); setNewColor('#e5e7eb'); setNewIcon('📁');
  }

  return (
    <aside style={{ width: expanded ? 220 : 40, transition: 'width 160ms ease', borderRight: '1px solid var(--border)', background: 'var(--surface-2)', minWidth: 0, overflow: 'auto', maxHeight: 'calc(100vh - 64px)' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: 6, justifyContent: expanded ? 'space-between' : 'center' }}>
        {expanded && <strong style={{ fontSize: 13 }}>Categories</strong>}
        <button title={expanded ? 'Collapse' : 'Expand'} onClick={() => setExpanded(v => !v)} aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'} style={{ background: 'transparent', border: 'none', cursor: 'pointer', lineHeight: 1 }}>{expanded ? '◀' : '▶'}</button>
      </div>
      {/* Built-ins */}
      <div style={{ padding: 6, display: 'grid', gap: 4 }}>
        {(expanded ? builtIns : builtIns).map(p => (
          <div key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 6, position: 'relative' }}>
            <span title={p.label} style={{ width: 12, height: 12, background: p.color, borderRadius: 3, display: 'inline-block' }} />
            {expanded && (
              <>
                <span style={{ width: 16, textAlign: 'center' }} aria-hidden>{p.icon || '•'}</span>
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
                          onClick={() => { updateColor(p.key, c); setOpenColorKey(null); }}
                          style={{ width: 16, height: 16, background: c, border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', padding: 0 }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>
      {/* Customs */}
  <div style={{ padding: 6, borderTop: '1px solid var(--border)', display: 'grid', gap: 4 }}>
        {expanded && <strong style={{ fontSize: 11, opacity: 0.7 }}>Custom</strong>}
        {customs.map(p => (
          <div key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 6, position: 'relative' }}>
            <span title={p.label} style={{ width: 12, height: 12, background: p.color, borderRadius: 3, display: 'inline-block' }} />
            {expanded && (
              <>
                <span style={{ width: 16, textAlign: 'center' }} aria-hidden>{p.icon || '•'}</span>
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
                          onClick={() => { updateColor(p.key, c); setOpenColorKey(null); }}
                          style={{ width: 16, height: 16, background: c, border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', padding: 0 }}
                        />
                      ))}
                    </div>
                  </div>
                )}
                <button onClick={() => removeCustom(p.key)} title="Remove" aria-label={`Remove ${p.label}`} style={{ background: 'transparent', border: '1px solid var(--border)', padding: '0 4px', borderRadius: 4, cursor: 'pointer', height: 20, lineHeight: 1 }}>×</button>
              </>
            )}
          </div>
        ))}
        {expanded && (
          <div style={{ display: 'grid', gap: 4, marginTop: 6 }}>
            <input placeholder="New category name" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} style={{ height: 28, padding: '4px 6px', fontSize: 13 }} />
            <input placeholder="Keywords (comma separated)" value={newKeywords} onChange={(e) => setNewKeywords(e.target.value)} style={{ height: 28, padding: '4px 6px', fontSize: 13 }} />
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
                        onClick={() => { setNewColor(c); setOpenColorKey(null); }}
                        style={{ width: 16, height: 16, background: c, border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', padding: 0 }}
                      />
                    ))}
                  </div>
                </div>
              )}
              <input placeholder="Icon (emoji)" value={newIcon} onChange={(e) => setNewIcon(e.target.value)} style={{ width: 48, height: 28, padding: '4px 6px', fontSize: 13 }} />
              <button onClick={addCustom} disabled={!newLabel.trim()} style={{ padding: '2px 6px', borderRadius: 4, border: '1px solid var(--border)', cursor: 'pointer', height: 28 }}>Add</button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
