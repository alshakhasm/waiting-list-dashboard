import { useEffect, useState, useMemo } from 'react';
import { getBacklog, seedDemoData, BacklogItem } from '../client/api';
import { classifyProcedure, GROUP_LABELS, GROUP_ORDER, GROUP_COLORS, ProcedureGroupKey } from './procedureGroups';

export function BacklogPage({
  search = '',
  onSelect,
  selectedId,
  pendingIds = [],
  onConfirm,
  hiddenIds = [],
  canConfirm = true,
}: {
  search?: string;
  onSelect?: (item: BacklogItem) => void;
  selectedId?: string;
  pendingIds?: string[];
  onConfirm?: (item: BacklogItem) => void;
  hiddenIds?: string[];
  canConfirm?: boolean;
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
    (async () => {
      await seedDemoData();
      const data = await getBacklog();
      setItems(data);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(
    () =>
      items
        .filter((i) => (i.patientName + ' ' + i.procedure).toLowerCase().includes(search.toLowerCase()))
        .filter((i) => !hiddenIds.includes(i.id)),
    [items, search, hiddenIds]
  );

  const grouped = useMemo(() => {
    const map = new Map<ProcedureGroupKey, BacklogItem[]>();
    for (const key of GROUP_ORDER) map.set(key, []);
    for (const it of filtered) {
      const key = classifyProcedure(it.procedure);
      map.set(key, [...(map.get(key) || []), it]);
    }
    return map;
  }, [filtered]);

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

  function removeItem(i: BacklogItem) {
    if (!hiddenIds.includes(i.id)) {
      // Hide from dashboard (soft remove)
      (onConfirm ? onConfirm : (() => {}))(i); // optional hook if provided
    }
    // Always hide locally
    if (!hiddenIds.includes(i.id)) hiddenIds.push(i.id);
    setItems(prev => prev.filter(it => it.id !== i.id));
    setOpenMenuId(null);
  }

  if (loading) return <div>Loading backlog…</div>;
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <span style={{ opacity: 0.6 }}>
          {filtered.length} of {items.length}
        </span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${GROUP_ORDER.length}, minmax(220px, 1fr))`,
          gap: 12,
          alignItems: 'start',
        }}
      >
        {GROUP_ORDER.map((key) => {
          const list = grouped.get(key) || [];
          return (
            <div key={key} style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
              <div
                style={{
                  padding: '8px 10px',
                  fontWeight: 600,
                  background: GROUP_COLORS[key],
                  borderBottom: '1px solid #e5e7eb',
                }}
              >
                {GROUP_LABELS[key]} <span style={{ opacity: 0.6 }}>({list.length})</span>
              </div>
              <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
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
                        border: selectedId === i.id ? '2px solid #3b82f6' : '1px solid #e5e7eb',
                        borderRadius: 6,
                        padding: 8,
                        background: '#fafafa',
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
                            <div role="menu" style={{ position: 'absolute', top: 6, right: 6, zIndex: 20, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, boxShadow: '0 4px 10px rgba(0,0,0,0.08)' }}>
                              <button role="menuitem" onClick={() => viewDetails(i)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', background: 'transparent', border: 'none', cursor: 'pointer' }}>View details</button>
                              <button role="menuitem" onClick={() => editItem(i)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', background: 'transparent', border: 'none', cursor: 'pointer' }}>Edit…</button>
                              <button role="menuitem" onClick={() => removeItem(i)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#b91c1c' }}>Remove</button>
                            </div>
                          )}
                        </div>
                      </div>
                      <div style={{ opacity: 0.8 }}>{i.procedure}</div>
                      <div style={{ fontVariantNumeric: 'tabular-nums', opacity: 0.7, fontSize: 12 }}>{i.maskedMrn}</div>
                      <div style={{ opacity: 0.7, fontSize: 12 }}>{i.estDurationMin} min</div>
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
