import { useEffect, useState, useMemo, useRef } from 'react';
import { getBacklog, seedDemoData, BacklogItem, softRemoveBacklogItem } from '../client/api';
import { classifyProcedure, GROUP_LABELS, GROUP_ORDER, GROUP_COLORS, ProcedureGroupKey } from './procedureGroups';
import { loadCategoryPrefs, defaultCategoryPrefs, saveCategoryPrefs } from './categoryPrefs';
import { getContrastText } from './color';

export function BacklogPage({
  search = '',
  onSelect,
  selectedId,
  pendingIds = [],
  onConfirm,
  hiddenIds = [],
  canConfirm = true,
  reloadKey,
}: {
  search?: string;
  onSelect?: (_item: BacklogItem) => void;
  selectedId?: string;
  pendingIds?: string[];
  onConfirm?: (_item: BacklogItem) => void;
  hiddenIds?: string[];
  canConfirm?: boolean;
  reloadKey?: number;
}) {
  const [items, setItems] = useState<BacklogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{
    patientName: string;
    mrn: string;
    procedure: string;
    estDurationMin: number;
    surgeonId?: string;
    caseTypeId: string;
    phone1?: string;
    phone2?: string;
    preferredDate?: string; // YYYY-MM-DD
    notes?: string;
  } | null>(null);

  // Zoom/scale percentage for the backlog grid
  const [scale, setScale] = useState<number>(() => {
    const v = (typeof localStorage !== 'undefined' && localStorage.getItem('backlog.scale')) || '100';
    const n = parseInt(v, 10);
    return Number.isFinite(n) && n >= 50 && n <= 200 ? n : 100;
  });
  useEffect(() => {
    try { localStorage.setItem('backlog.scale', String(scale)); } catch {}
  }, [scale]);

  // Contrast helper now imported from ./color

  // Real data for dropdowns: collect unique surgeons and case types from loaded backlog
  const surgeonOptions = useMemo<string[]>(() => {
    const set = new Set<string>();
    for (const it of items) if (it.surgeonId) set.add(it.surgeonId);
    return Array.from(set);
  }, [items]);
  const caseTypeOptions = useMemo<string[]>(() => {
    const set = new Set<string>();
    for (const it of items) if (it.caseTypeId) set.add(it.caseTypeId);
    // Ensure some sensible defaults are present
    ['case:elective', 'case:urgent', 'case:emergency'].forEach((k) => set.add(k));
    return Array.from(set);
  }, [items]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await seedDemoData();
      const data = await getBacklog();
      if (!cancelled) {
        setItems(data);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [reloadKey]);

  // Sidebar category preferences (hidden + color overrides)
  const [prefs, setPrefs] = useState(() => loadCategoryPrefs(defaultCategoryPrefs()));
  const hiddenKeys = useMemo(() => new Set(prefs.filter((p) => p.hidden).map((p) => p.key)), [prefs]);

  useEffect(() => {
    function onPrefs(e: Event) {
      try {
        const detail = (e as CustomEvent).detail as any[] | undefined;
        if (Array.isArray(detail)) {
          setPrefs(detail as any);
          return;
        }
      } catch {}
      // fallback: reload persisted prefs
      try { setPrefs(loadCategoryPrefs(defaultCategoryPrefs())); } catch {}
    }
    window.addEventListener('category-prefs-changed', onPrefs as EventListener);
    return () => window.removeEventListener('category-prefs-changed', onPrefs as EventListener);
  }, []);

  const filtered = useMemo(
    () =>
      items
        .filter((i) => (i.patientName + ' ' + i.procedure).toLowerCase().includes(search.toLowerCase()))
        .filter((i) => !hiddenIds.includes(i.id)),
    [items, search, hiddenIds]
  );

  const grouped = useMemo(() => {
    // Use string keys so custom category keys are supported
    const map = new Map<string, BacklogItem[]>();
    for (const key of GROUP_ORDER) map.set(key as string, []);
    for (const it of filtered) {
      const k = it.categoryKey || classifyProcedure(it.procedure);
      map.set(k, [...(map.get(k) || []), it]);
    }
    return map;
  }, [filtered]);

  // Build the ordered list of columns:
  // 1) Use the order from saved prefs for ALL categories (built-in and custom), excluding hidden
  // 2) Append any extra category keys discovered in data that aren't present in prefs
  const columnKeys = useMemo(() => {
    // Order driven by prefs (persisted and updated by drag/drop)
    const orderedFromPrefs = prefs
      .filter((p) => !p.hidden)
      .map((p) => p.key);

    const known = new Set(orderedFromPrefs);

    // Discover any category keys present in data that aren't in prefs yet
    const extras: string[] = [];
    for (const k of Array.from(grouped.keys())) {
      if (!hiddenKeys.has(k) && !known.has(k)) extras.push(k);
    }

    return [...orderedFromPrefs, ...extras];
  }, [prefs, grouped, hiddenKeys]);

  // Expose a runtime helper to inspect the columnKeys computed by the page.
  useEffect(() => {
    try {
      (window as any).appDebug = { ...(window as any).appDebug, dumpBacklogColumns: () => {
        try { console.log('[dumpBacklogColumns]', columnKeys); } catch {}
        return columnKeys;
      } };
    } catch {}
    return () => {};
  }, [columnKeys]);

  // Drag state for column reordering
  const [dragColKey, setDragColKey] = useState<string | null>(null);
  const [dragOverColKey, setDragOverColKey] = useState<string | null>(null);

  function reorderPrefs(fromKey: string, toKey: string | null) {
    try {
      if (toKey && toKey === fromKey) return; // no-op
      const current = loadCategoryPrefs(defaultCategoryPrefs());
      const fromIndex = current.findIndex((p) => p.key === fromKey);
      if (fromIndex === -1) return;
      const out = current.slice();
      const [item] = out.splice(fromIndex, 1);
      if (!toKey) {
        out.push(item);
      } else {
        const toIndex = out.findIndex((p) => p.key === toKey);
        if (toIndex === -1) out.push(item);
        else out.splice(toIndex, 0, item);
      }
      saveCategoryPrefs(out);
      // Notify other components
      try { window.dispatchEvent(new CustomEvent('category-prefs-changed', { detail: out })); } catch {}
    } catch (e) {
      console.warn('reorderPrefs failed', e);
    }
  }

  // Close open menu on outside click
  useEffect(() => {
    if (!openMenuId) return;
    function onDocClick() { setOpenMenuId(null); }
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [openMenuId]);

  function maskMrn(mrn: string): string {
    try { return mrn.replace(/.(?=.{2}$)/g, '•'); } catch { return mrn; }
  }

  function viewDetails(i: BacklogItem) {
    const lines = [
      `Patient: ${i.patientName}`,
      `MRN: ${i.mrn}`,
      `Procedure: ${i.procedure}`,
      `Estimated duration: ${i.estDurationMin} min`,
      i.surgeonId ? `Surgeon: ${i.surgeonId}` : '',
      `Case type: ${i.caseTypeId}`,
      i.phone1 ? `Phone 1: ${i.phone1}` : '',
      i.phone2 ? `Phone 2: ${i.phone2}` : '',
      i.preferredDate ? `Preferred date: ${i.preferredDate}` : '',
      i.notes ? `Notes: ${i.notes}` : '',
    ].filter(Boolean);
    window.alert?.(lines.join('\n'));
  }

  function editItem(i: BacklogItem) {
    setEditingId(i.id);
    setEditDraft({
      patientName: i.patientName,
      mrn: i.mrn,
      procedure: i.procedure,
      estDurationMin: i.estDurationMin,
      surgeonId: i.surgeonId,
      caseTypeId: i.caseTypeId,
      phone1: i.phone1,
      phone2: i.phone2,
      preferredDate: i.preferredDate,
      notes: i.notes,
    });
    setOpenMenuId(null);
  }

  async function removeItem(i: BacklogItem) {
    try {
      await softRemoveBacklogItem(i.id);
    } catch (e) {
      console.warn('soft remove failed, removing locally only', e);
    }
    if (!hiddenIds.includes(i.id)) {
      (onConfirm ? onConfirm : (() => {}))(i);
    }
    if (!hiddenIds.includes(i.id)) hiddenIds.push(i.id);
    setItems(prev => prev.filter(it => it.id !== i.id));
    setOpenMenuId(null);
  }

  const scaleFactor = Math.max(0.5, Math.min(2, scale / 100));

  // Keyboard shortcuts for zooming (Cmd/Ctrl + '+', '-', or '0')
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const isMeta = e.metaKey || e.ctrlKey;
      if (!isMeta) return;
      // Don't hijack when typing in inputs or textareas or contenteditable
      const target = e.target as HTMLElement | null;
      const tag = (target?.tagName || '').toLowerCase();
      const editable = target && (target.getAttribute('contenteditable') === 'true');
      if (tag === 'input' || tag === 'textarea' || editable) return;

      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        setScale((s) => Math.min(200, s + 10));
      } else if (e.key === '-') {
        e.preventDefault();
        setScale((s) => Math.max(50, s - 10));
      } else if (e.key === '0') {
        e.preventDefault();
        setScale(100);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Persist horizontal scroll of the columns area
  const scrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const key = 'backlog.scroll.left';
    const el = scrollRef.current;
    if (!el) return;
    try {
      const saved = parseInt(localStorage.getItem(key) || '0', 10);
      if (Number.isFinite(saved) && saved > 0) el.scrollLeft = saved;
    } catch {}
    const onScroll = () => {
      try { localStorage.setItem(key, String(el.scrollLeft)); } catch {}
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [items.length]);

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
        <div style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={() => setScale((s) => Math.max(50, s - 10))}
            title="Zoom out"
            style={{ padding: '2px 8px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface-1)', cursor: 'pointer' }}
          >−</button>
          <select
            value={scale}
            onChange={(e) => setScale(parseInt(e.target.value, 10))}
            title="Backlog scale"
            style={{ padding: '2px 6px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface-1)' }}
          >
            {[200,175,150,125,110,100,90,80,75,70,67,60,50].map((p) => (
              <option key={p} value={p}>{p}%</option>
            ))}
          </select>
          <button
            onClick={() => setScale((s) => Math.min(200, s + 10))}
            title="Zoom in"
            style={{ padding: '2px 8px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface-1)', cursor: 'pointer' }}
          >+</button>
          <button
            onClick={() => setScale(100)}
            title="Reset to 100%"
            style={{ padding: '2px 8px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface-1)', cursor: 'pointer' }}
          >100%</button>
          {/* Reorder fallback UI */}
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginLeft: 8 }}>
            <input type="checkbox" checked={!!(dragColKey === '__reorder_mode__')} onChange={(e) => { if (e.target.checked) setDragColKey('__reorder_mode__'); else setDragColKey(null); }} />
            <span style={{ fontSize: 12 }}>Reorder columns</span>
          </label>
        </div>
      </div>

      {loading ? (
        <div>Loading backlog…</div>
      ) : (
  <div ref={scrollRef} style={{ overflow: 'auto' }}>
        <div
          style={{
            transform: `scale(${scaleFactor})`,
            transformOrigin: 'top left',
            // Counter the shrinking so it fits the viewport width nicely
            width: `${100 / scaleFactor}%`,
          }}
        >
          <div
            style={{
              display: 'grid',
              // Edge-to-edge columns: no gaps between
              gap: 0,
              alignItems: 'start',
              gridTemplateColumns: `repeat(${columnKeys.length}, minmax(220px, 1fr))`,
            }}
          >
        {columnKeys.map((key, idx) => {
          const list = grouped.get(key as ProcedureGroupKey) || [];
          // Derive a soft tint for the whole column based on the header color
          const pref = prefs.find(p => p.key === key);
          const bg = (pref?.color) || (GROUP_COLORS as any)[key];
          const headerText = pref?.textColor || getContrastText(bg);
          // Ensure readable text on light tints (especially in dark mode where default text is light)
          const bodyText = headerText;
          const colBg = `color-mix(in srgb, ${bg}, white 78%)`;
          const cardBg = `color-mix(in srgb, ${bg}, white 78%)`;
    const borderCol = `color-mix(in srgb, ${bg}, white 55%)`;
          return (
            <div
              key={key}
              onDragOver={(e) => { e.preventDefault(); try { console.debug('[BacklogPage] dragover', key); } catch {} setDragOverColKey(key); }}
              onDrop={(e) => {
                e.preventDefault();
                try { console.debug('[BacklogPage] drop target', key); } catch {}
                const from = dragColKey || (e.dataTransfer.getData('text/plain') || null);
                try { console.debug('[BacklogPage] drop from', from); } catch {}
                if (from && from !== key) reorderPrefs(from, key);
                setDragColKey(null);
                setDragOverColKey(null);
              }}
              style={{
                // Draw a single-pixel seam between columns without doubling borders
                borderTop: `1px solid ${borderCol}`,
                borderBottom: `1px solid ${borderCol}`,
                borderRight: `1px solid ${borderCol}`,
                borderLeft: idx === 0 ? `1px solid ${borderCol}` : 'none',
                borderRadius: 0,
                overflow: 'hidden',
                background: colBg,
                outline: dragOverColKey === key ? `3px solid ${headerText}55` : 'none',
              }}
            >
              <div
                style={{
                  padding: '8px 10px',
                  fontWeight: 600,
                  background: bg,
                  color: headerText,
                  borderBottom: `1px solid ${borderCol}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  cursor: 'grab',
                }}
                draggable
                onDragStart={(e) => {
                  try { console.debug('[BacklogPage] dragstart', key); } catch {}
                  try { e.dataTransfer.setData('text/plain', key); } catch {}
                  try {
                    const img = document.createElement('canvas');
                    img.width = 1; img.height = 1;
                    e.dataTransfer.setDragImage(img, 0, 0);
                  } catch {}
                  setDragColKey(key);
                }}
                onDragEnd={() => { setDragColKey(null); setDragOverColKey(null); }}
                onMouseDown={(e) => {
                  if (dragColKey !== '__reorder_mode__') return;
                  setDragColKey(`__reorder_source__:${key}`);
                }}
              >
                {/* drag handle visual (still visible) */}
                <div title="Drag to reorder columns" style={{ width: 18, height: 18, display: 'grid', gap: 2, alignContent: 'center' }} aria-hidden>
                  <div style={{ height: 2, background: headerText, borderRadius: 1 }} />
                  <div style={{ height: 2, background: headerText, borderRadius: 1 }} />
                </div>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>{pref?.label || (GROUP_LABELS as any)[key] || key} <span style={{ opacity: 0.7 }}>({list.length})</span></div>
                  {dragColKey && (dragColKey as string).startsWith('__reorder_source__:') && (
                    <button onClick={() => { const src = (dragColKey as string).split(':', 2)[1]; reorderPrefs(src, key); setDragColKey(null); }} style={{ marginLeft: 8, padding: '4px 6px', fontSize: 12 }}>Move here</button>
                  )}
                </div>
              </div>
              <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 8, color: bodyText }}>
                {list.length === 0 ? (
                  <div style={{ opacity: 0.6, fontSize: 12 }}>No items</div>
                ) : (
                  list.map((i) => (
                    <div
                      key={i.id}
                      draggable
                      onDragStart={(e) => {
                        const payload = { itemId: i.id, estDurationMin: i.estDurationMin, surgeonId: i.surgeonId };
                        const text = JSON.stringify(payload);
                        try { e.dataTransfer.setData('application/json', text); } catch {}
                        try { e.dataTransfer.setData('text/plain', text); } catch {}
                        try { e.dataTransfer.setData('text', text); } catch {}
                        e.dataTransfer.effectAllowed = 'copyMove';
                      }}
                      onClick={() => onSelect?.(i)}
                      style={{
                        border: selectedId === i.id ? `2px solid var(--primary)` : `1px solid ${borderCol}`,
                        borderRadius: 6,
                        padding: 8,
                        background: cardBg,
                        cursor: onSelect ? 'pointer' : 'default',
                        position: 'relative',
                      }}
                      title={onSelect ? 'Click to select' : undefined}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong>{i.patientName}</strong>
                        <div onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => setOpenMenuId(prev => prev === i.id ? null : i.id)}
                            title="Edit and options"
                            aria-label="Edit and options"
                            aria-haspopup="menu"
                            aria-expanded={openMenuId === i.id}
                            style={{
                              background: 'transparent', border: 'none', padding: 0, margin: 0,
                              width: 24, height: 24, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              cursor: 'pointer', opacity: 0.7,
                            }}
                          >
                            <span aria-hidden="true" style={{ lineHeight: '1', fontSize: 16 }}>⋮</span>
                          </button>
                          {openMenuId === i.id && (
                            <div role="menu" style={{ position: 'absolute', top: 6, right: 6, zIndex: 20, background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 6, boxShadow: '0 4px 10px var(--shadow)' }}>
                              <button role="menuitem" onClick={() => viewDetails(i)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', background: 'transparent', border: 'none', cursor: 'pointer' }}>View details</button>
                              <button role="menuitem" onClick={() => editItem(i)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', background: 'transparent', border: 'none', cursor: 'pointer' }}>Edit…</button>
                              <button role="menuitem" onClick={() => removeItem(i)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--danger)' }}>Remove</button>
                            </div>
                          )}
                        </div>
                      </div>
                      <div style={{ opacity: 0.9 }}>{i.procedure}</div>
                      <div style={{ fontVariantNumeric: 'tabular-nums', opacity: 0.8, fontSize: 12 }}>{i.maskedMrn}</div>
                      <div style={{ opacity: 0.8, fontSize: 12 }}>{i.estDurationMin} min</div>
                      {pendingIds.includes(i.id) && canConfirm && (
                        <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <input id={`confirm-${i.id}`} type="checkbox" onChange={() => onConfirm?.(i)} />
                          <label htmlFor={`confirm-${i.id}`} style={{ fontSize: 12 }}>
                            Awaiting confirmation — tick to remove from Dashboard
                          </label>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
          </div>
        </div>
      </div>
      )}

      {/* Edit Modal */}
      {editingId && editDraft && (
        <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }} onClick={() => { /* click backdrop closes */ setEditingId(null); setEditDraft(null); }}>
          <div style={{ background: '#fff', borderRadius: 8, width: 'min(560px, 92vw)', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 10px 24px rgba(0,0,0,0.15)' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <strong>Edit backlog item</strong>
              <button onClick={() => { setEditingId(null); setEditDraft(null); }} aria-label="Close" style={{ background: 'transparent', border: 'none', fontSize: 18, cursor: 'pointer' }}>×</button>
            </div>
            <div style={{ padding: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontSize: 12, opacity: 0.8 }}>Patient name</span>
                <input value={editDraft.patientName} onChange={(e) => setEditDraft({ ...editDraft, patientName: e.target.value })} style={{ padding: 8, borderRadius: 6, border: '1px solid #e5e7eb' }} />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontSize: 12, opacity: 0.8 }}>MRN</span>
                <input value={editDraft.mrn} onChange={(e) => setEditDraft({ ...editDraft, mrn: e.target.value })} style={{ padding: 8, borderRadius: 6, border: '1px solid #e5e7eb' }} />
              </label>
              <label style={{ display: 'grid', gap: 6, gridColumn: '1 / -1' }}>
                <span style={{ fontSize: 12, opacity: 0.8 }}>Procedure / arrangement</span>
                <input value={editDraft.procedure} onChange={(e) => setEditDraft({ ...editDraft, procedure: e.target.value })} style={{ padding: 8, borderRadius: 6, border: '1px solid #e5e7eb' }} />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontSize: 12, opacity: 0.8 }}>Phone 1</span>
                <input value={editDraft.phone1 || ''} onChange={(e) => setEditDraft({ ...editDraft, phone1: e.target.value || undefined })} style={{ padding: 8, borderRadius: 6, border: '1px solid #e5e7eb' }} />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontSize: 12, opacity: 0.8 }}>Phone 2</span>
                <input value={editDraft.phone2 || ''} onChange={(e) => setEditDraft({ ...editDraft, phone2: e.target.value || undefined })} style={{ padding: 8, borderRadius: 6, border: '1px solid #e5e7eb' }} />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontSize: 12, opacity: 0.8 }}>Estimated duration (min)</span>
                <input type="number" min={0} value={editDraft.estDurationMin} onChange={(e) => setEditDraft({ ...editDraft, estDurationMin: Math.max(0, parseInt(e.target.value || '0', 10)) })} style={{ padding: 8, borderRadius: 6, border: '1px solid #e5e7eb' }} />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontSize: 12, opacity: 0.8 }}>Surgeon</span>
                <select
                  value={editDraft.surgeonId || ''}
                  onChange={(e) => setEditDraft({ ...editDraft, surgeonId: e.target.value || undefined })}
                  style={{ padding: 8, borderRadius: 6, border: '1px solid #e5e7eb' }}
                >
                  <option value="">— None —</option>
                  {surgeonOptions.map((sid) => (
                    <option key={sid} value={sid}>{sid}</option>
                  ))}
                </select>
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontSize: 12, opacity: 0.8 }}>Case type</span>
                <select
                  value={editDraft.caseTypeId}
                  onChange={(e) => setEditDraft({ ...editDraft, caseTypeId: e.target.value })}
                  style={{ padding: 8, borderRadius: 6, border: '1px solid #e5e7eb' }}
                >
                  {caseTypeOptions.map((ct) => (
                    <option key={ct} value={ct}>{ct}</option>
                  ))}
                </select>
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontSize: 12, opacity: 0.8 }}>Preferred date</span>
                <input type="date" value={editDraft.preferredDate || ''} onChange={(e) => setEditDraft({ ...editDraft, preferredDate: e.target.value || undefined })} style={{ padding: 8, borderRadius: 6, border: '1px solid #e5e7eb' }} />
              </label>
              <label style={{ display: 'grid', gap: 6, gridColumn: '1 / -1' }}>
                <span style={{ fontSize: 12, opacity: 0.8 }}>Notes</span>
                <textarea rows={3} value={editDraft.notes || ''} onChange={(e) => setEditDraft({ ...editDraft, notes: e.target.value || undefined })} style={{ padding: 8, borderRadius: 6, border: '1px solid #e5e7eb', resize: 'vertical' }} />
              </label>
            </div>
            <div style={{ padding: 16, display: 'flex', justifyContent: 'flex-end', gap: 8, borderTop: '1px solid #e5e7eb' }}>
              <button onClick={() => { setEditingId(null); setEditDraft(null); }} style={{ background: '#fff', border: '1px solid #e5e7eb', padding: '8px 12px', borderRadius: 6, cursor: 'pointer' }}>Cancel</button>
              <button
                onClick={() => {
                  if (!editDraft) return;
                  const cleanDur = Number.isFinite(editDraft.estDurationMin) ? editDraft.estDurationMin : 0;
                  setItems(prev => prev.map(it => it.id === editingId ? {
                    ...it,
                    patientName: editDraft.patientName.trim() || it.patientName,
                    mrn: editDraft.mrn.trim() || it.mrn,
                    maskedMrn: maskMrn(editDraft.mrn.trim() || it.mrn),
                    procedure: editDraft.procedure.trim() || it.procedure,
                    estDurationMin: Math.max(0, cleanDur),
                    surgeonId: editDraft.surgeonId,
                    caseTypeId: editDraft.caseTypeId,
                    phone1: editDraft.phone1,
                    phone2: editDraft.phone2,
                    preferredDate: editDraft.preferredDate,
                    notes: editDraft.notes,
                  } : it));
                  setEditingId(null);
                  setEditDraft(null);
                }}
                style={{ background: '#3b82f6', color: '#fff', border: '1px solid #3b82f6', padding: '8px 12px', borderRadius: 6, cursor: 'pointer' }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
