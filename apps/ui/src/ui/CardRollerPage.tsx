import { useEffect, useMemo, useRef, useState } from 'react';
import { BacklogItem, createSchedule, getBacklog, softRemoveBacklogItem } from '../client/api';
import { GROUP_LABELS, ProcedureGroupKey, classifyProcedure, GROUP_ORDER } from './procedureGroups';
import { loadCategoryPrefs, defaultCategoryPrefs } from './categoryPrefs';
import { CardRollerCard } from './CardRollerCard';

export function CardRollerPage() {
  // Require category selection; show a selector at top.
  const [category, setCategory] = useState<ProcedureGroupKey | '' | 'ALL'>('ALL');
  const [items, setItems] = useState<BacklogItem[]>([]);
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [scheduling, setScheduling] = useState<{ open: boolean; item: BacklogItem | null }>({ open: false, item: null });
  const [edit, setEdit] = useState<{ open: boolean; item: BacklogItem | null }>({ open: false, item: null });
  const itemEls = useRef<Map<string, HTMLDivElement>>(new Map());

  // Dropdown option helpers from items
  const surgeonOptions = useMemo<string[]>(() => {
    const set = new Set<string>();
    for (const it of items) if (it.surgeonId) set.add(it.surgeonId);
    return Array.from(set);
  }, [items]);
  const caseTypeOptions = useMemo<string[]>(() => {
    const set = new Set<string>();
    for (const it of items) if (it.caseTypeId) set.add(it.caseTypeId);
    ['case:elective', 'case:urgent', 'case:emergency'].forEach((k) => set.add(k));
    return Array.from(set);
  }, [items]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const data = await getBacklog();
      if (!cancelled) {
        setItems(data);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Prefer built-ins only for selection; hide hidden categories
  const prefs = useMemo(() => loadCategoryPrefs(defaultCategoryPrefs()), []);
  const availableCategories = useMemo(() => prefs.filter(p => p.builtIn && !p.hidden).map(p => p.key as ProcedureGroupKey), [prefs]);

  const filtered = useMemo(() => {
    const sel = category;
    const allowed = new Set<ProcedureGroupKey>(availableCategories);
    const list = items.filter((i) => {
      const k = (i.categoryKey || classifyProcedure(i.procedure)) as ProcedureGroupKey;
      if (!allowed.has(k)) return false;
      // When 'ALL' show all allowed; when a specific category is chosen, match it; when empty (none), show none
      return sel === 'ALL' ? true : sel ? k === sel : false;
    });
    return list.sort((a, b) => {
      const ta = a.createdAt ? Date.parse(a.createdAt) : 0;
      const tb = b.createdAt ? Date.parse(b.createdAt) : 0;
      return ta - tb;
    });
  }, [items, category, availableCategories]);

  // Clamp index when filter changes
  useEffect(() => {
    if (idx >= filtered.length) setIdx(0);
  }, [filtered.length]);

  // Keyboard navigation: Up = previous, Down = next. Stop at ends.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Don't hijack when typing in inputs/textareas or contenteditable
      const target = e.target as HTMLElement | null;
      const tag = (target?.tagName || '').toLowerCase();
      const editable = target && (target.getAttribute('contenteditable') === 'true');
      if (tag === 'input' || tag === 'textarea' || editable) return;
      // Ignore key autorepeat so it advances one card per key press
      if (e.repeat) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (idx < filtered.length - 1) setIdx((i) => i + 1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (idx > 0) setIdx((i) => i - 1);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [idx, filtered.length]);

  const current = filtered[idx];

  // Auto-scroll current into view
  useEffect(() => {
    const el = current ? itemEls.current.get(current.id) : null;
    if (el) {
      try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
      catch { el.scrollIntoView({ block: 'center' }); }
    }
  }, [current?.id]);

  return (
    <div style={{ padding: 8, display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, opacity: 0.7 }}>Category</span>
          <select value={category} onChange={(e) => setCategory(e.target.value as any)}>
            <option value="">— Select category —</option>
            <option value="ALL">ALL</option>
            {availableCategories.map((k) => (
              <option key={k} value={k}>{GROUP_LABELS[k]}</option>
            ))}
          </select>
        </label>
        {category && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <button onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0} title="Previous">↑</button>
            <div style={{ fontSize: 12, opacity: 0.7, minWidth: 80, textAlign: 'center' }}>{filtered.length ? `${idx + 1} / ${filtered.length}` : '0 / 0'}</div>
            <button onClick={() => setIdx((i) => Math.min(filtered.length - 1, i + 1))} disabled={idx >= filtered.length - 1} title="Next">↓</button>
          </div>
        )}
      </div>
      {loading ? (
        <div>Loading…</div>
      ) : !category ? (
        <div style={{ opacity: 0.7 }}>Pick a category to start rolling through cards.</div>
      ) : filtered.length === 0 ? (
        <div style={{ opacity: 0.7 }}>No items in this category.</div>
      ) : (
        <>
          {/* Right-center floating navigation arrows */}
          <div style={{ position: 'fixed', right: 24, top: '50%', transform: 'translateY(-50%)', display: 'grid', gap: 8, zIndex: 60 }}>
            <button
              title="Previous"
              aria-label="Previous"
              onClick={() => setIdx((i) => Math.max(0, i - 1))}
              disabled={idx === 0}
              style={{ width: 44, height: 44, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface-1)', color: 'var(--text)', fontSize: 18 }}
            >
              ↑
            </button>
            <div style={{ fontSize: 12, opacity: 0.7, textAlign: 'center' }}>{filtered.length ? `${idx + 1}/${filtered.length}` : '0/0'}</div>
            <button
              title="Next"
              aria-label="Next"
              onClick={() => setIdx((i) => Math.min(filtered.length - 1, i + 1))}
              disabled={idx >= filtered.length - 1}
              style={{ width: 44, height: 44, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface-1)', color: 'var(--text)', fontSize: 18 }}
            >
              ↓
            </button>
          </div>
          {/* Hide native scrollbar rail for a cleaner look */}
          <style>{`
            .roller-scroll { scrollbar-width: none; -ms-overflow-style: none; }
            .roller-scroll::-webkit-scrollbar { width: 0; height: 0; display: none; }

            .roller-list { display: grid; gap: 28px; padding: 24px 0; }
            .roller-item {
              outline: none;
              border-radius: 0;
              transform: scale(0.96);
              opacity: 0.75;
              box-shadow: 0 8px 26px var(--shadow);
              border: 2px solid transparent;
              scroll-snap-align: center;
              transition: transform 240ms cubic-bezier(.22,1,.36,1), box-shadow 240ms cubic-bezier(.22,1,.36,1), opacity 200ms ease;
            }
            .roller-item.selected {
              transform: scale(1.05);
              opacity: 1;
              box-shadow: 0 20px 52px var(--shadow);
              border: 2px solid var(--primary);
              animation: roller-pulse 420ms ease-out;
            }
            @keyframes roller-pulse {
              0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--primary), transparent 75%), 0 20px 52px var(--shadow); }
              100% { box-shadow: 0 0 0 18px color-mix(in srgb, var(--primary), transparent 100%), 0 20px 52px var(--shadow); }
            }
            @media (prefers-reduced-motion: reduce) {
              .roller-item { transition: none; }
              .roller-item.selected { animation: none; }
            }
          `}</style>
          {/* Centered stacked cards inside a snapping scroll container */}
          <div className="roller-scroll" style={{ maxWidth: 1400, margin: '0 auto', height: 'calc(100vh - 140px)', overflowY: 'auto', scrollBehavior: 'smooth', scrollSnapType: 'y mandatory' as any }}>
            <div className="roller-list">
              {filtered.map((it, i) => (
                <div
                  key={it.id}
                  ref={(el) => {
                    if (el) itemEls.current.set(it.id, el);
                    else itemEls.current.delete(it.id);
                  }}
                  onClick={() => setIdx(i)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIdx(i); } }}
                  aria-selected={i === idx}
                  className={`roller-item${i === idx ? ' selected' : ''}`}
                >
                  <CardRollerCard
                    item={it}
                    onEdit={(i2) => setEdit({ open: true, item: i2 })}
                    onSchedule={(i2) => setScheduling({ open: true, item: i2 })}
                    onRemove={async (i2) => {
                      try {
                        await softRemoveBacklogItem(i2.id);
                        setItems((prev) => prev.filter((x) => x.id !== i2.id));
                        setIdx((n) => {
                          const nextLen = filtered.length - 1;
                          if (n > i) return Math.max(0, n - 1);
                          return Math.min(n, Math.max(0, nextLen - 1));
                        });
                      } catch (e: any) {
                        window.alert?.(e?.message || 'Failed to remove');
                      }
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Simple scheduling dialog */}
      {scheduling.open && scheduling.item && (
        <ScheduleDialog
          item={scheduling.item}
          onClose={() => setScheduling({ open: false, item: null })}
          onCreate={async ({ date, startTime, endTime }) => {
            try {
              const roomId = 'or:1';
              const surgeonId = scheduling.item?.surgeonId || 's:1';
              await createSchedule({ waitingListItemId: scheduling.item!.id, roomId, surgeonId, date, startTime, endTime });
              setScheduling({ open: false, item: null });
            } catch (e: any) {
              window.alert?.(e?.message || 'Failed to create schedule');
            }
          }}
        />
      )}

      {/* Minimal Edit dialog (local-only for now) */}
      {edit.open && edit.item && (
        <EditDialog
          item={edit.item}
          surgeonOptions={surgeonOptions}
          caseTypeOptions={caseTypeOptions}
          categoryOptions={availableCategories}
          onClose={() => setEdit({ open: false, item: null })}
          onSave={(patch) => {
            setItems((prev) => prev.map((it) => it.id === edit.item!.id ? { ...it, ...patch } : it));
            setEdit({ open: false, item: null });
          }}
        />
      )}
    </div>
  );
}

function ScheduleDialog({ item, onClose, onCreate }: { item: BacklogItem; onClose: () => void; onCreate: (v: { date: string; startTime: string; endTime: string }) => void }) {
  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [startTime, setStart] = useState('08:00');
  const [endTime, setEnd] = useState('09:00');
  return (
    <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'grid', placeItems: 'center', zIndex: 50 }} onClick={onClose}>
      <div style={{ background: 'var(--surface-1)', color: 'var(--text)', borderRadius: 8, padding: 16, width: 360 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Schedule {item.patientName}</div>
        <div style={{ display: 'grid', gap: 8 }}>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontSize: 12, opacity: 0.7 }}>Start</span>
            <input type="time" value={startTime} onChange={(e) => setStart(e.target.value)} />
          </label>
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontSize: 12, opacity: 0.7 }}>End</span>
            <input type="time" value={endTime} onChange={(e) => setEnd(e.target.value)} />
          </label>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button onClick={onClose}>Cancel</button>
            <button onClick={() => onCreate({ date, startTime, endTime })}>Create</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EditDialog({ item, surgeonOptions, caseTypeOptions, categoryOptions, onClose, onSave }: {
  item: BacklogItem;
  surgeonOptions: string[];
  caseTypeOptions: string[];
  categoryOptions: ProcedureGroupKey[];
  onClose: () => void;
  onSave: (patch: Partial<BacklogItem>) => void;
}) {
  const [patientName, setPatientName] = useState(item.patientName);
  const [mrn, setMrn] = useState(item.mrn);
  const [procedure, setProcedure] = useState(item.procedure);
  const [estDurationMin, setEst] = useState<number>(item.estDurationMin);
  const [surgeonId, setSurgeon] = useState<string | undefined>(item.surgeonId);
  const [caseTypeId, setCaseType] = useState<string>(item.caseTypeId);
  const [phone1, setPhone1] = useState(item.phone1 || '');
  const [phone2, setPhone2] = useState(item.phone2 || '');
  const [preferredDate, setPreferredDate] = useState(item.preferredDate || '');
  const [notes, setNotes] = useState(item.notes || '');
  const [categoryKey, setCategoryKey] = useState<ProcedureGroupKey | undefined>(item.categoryKey);

  function maskMrn(s: string): string { try { return s.replace(/.(?=.{2}$)/g, '•'); } catch { return s; } }

  return (
    <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'grid', placeItems: 'center', zIndex: 50 }} onClick={onClose}>
      <div style={{ background: 'var(--surface-1)', color: 'var(--text)', borderRadius: 8, padding: 16, width: 'min(720px, 92vw)' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Edit {item.patientName}</div>
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '1fr 1fr' }}>
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontSize: 12, opacity: 0.7 }}>Patient name</span>
            <input value={patientName} onChange={(e) => setPatientName(e.target.value)} />
          </label>
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontSize: 12, opacity: 0.7 }}>MRN</span>
            <input value={mrn} onChange={(e) => setMrn(e.target.value.replace(/\D+/g, ''))} />
          </label>
          <label style={{ display: 'grid', gap: 4, gridColumn: '1 / -1' }}>
            <span style={{ fontSize: 12, opacity: 0.7 }}>Procedure</span>
            <input value={procedure} onChange={(e) => setProcedure(e.target.value)} />
          </label>
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontSize: 12, opacity: 0.7 }}>Estimated duration (min)</span>
            <input type="number" min={0} value={estDurationMin} onChange={(e) => setEst(Math.max(0, parseInt(e.target.value || '0', 10)))} />
          </label>
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontSize: 12, opacity: 0.7 }}>Surgeon</span>
            <select value={surgeonId || ''} onChange={(e) => setSurgeon(e.target.value || undefined)}>
              <option value="">— None —</option>
              {surgeonOptions.map((sid) => (<option key={sid} value={sid}>{sid}</option>))}
            </select>
          </label>
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontSize: 12, opacity: 0.7 }}>Case type</span>
            <select value={caseTypeId} onChange={(e) => setCaseType(e.target.value)}>
              {caseTypeOptions.map((ct) => (<option key={ct} value={ct}>{ct}</option>))}
            </select>
          </label>
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontSize: 12, opacity: 0.7 }}>Phone 1</span>
            <input value={phone1} onChange={(e) => setPhone1(e.target.value)} />
          </label>
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontSize: 12, opacity: 0.7 }}>Phone 2</span>
            <input value={phone2} onChange={(e) => setPhone2(e.target.value)} />
          </label>
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontSize: 12, opacity: 0.7 }}>Preferred date</span>
            <input type="date" value={preferredDate} onChange={(e) => setPreferredDate(e.target.value)} />
          </label>
          <label style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontSize: 12, opacity: 0.7 }}>Category</span>
            <select value={categoryKey || ''} onChange={(e) => setCategoryKey((e.target.value || undefined) as any)}>
              <option value="">— Auto by procedure —</option>
              {categoryOptions.map((k) => (<option key={k} value={k}>{GROUP_LABELS[k]}</option>))}
            </select>
          </label>
          <label style={{ display: 'grid', gap: 4, gridColumn: '1 / -1' }}>
            <span style={{ fontSize: 12, opacity: 0.7 }}>Notes</span>
            <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
          <button onClick={onClose}>Cancel</button>
          <button onClick={() => {
            const mrnClean = mrn.trim();
            const patch: Partial<BacklogItem> = {
              patientName: patientName.trim() || item.patientName,
              mrn: mrnClean || item.mrn,
              maskedMrn: maskMrn(mrnClean || item.mrn),
              procedure: procedure.trim() || item.procedure,
              estDurationMin: Math.max(0, estDurationMin || 0),
              surgeonId,
              caseTypeId,
              phone1: phone1 || undefined,
              phone2: phone2 || undefined,
              preferredDate: preferredDate || undefined,
              notes: notes || undefined,
              categoryKey: categoryKey || undefined,
            };
            onSave(patch);
          }}>Save</button>
        </div>
      </div>
    </div>
  );
}
