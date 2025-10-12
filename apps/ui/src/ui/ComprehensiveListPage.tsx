import { useEffect, useMemo, useState } from 'react';
import { BacklogItem, getBacklog, updateBacklogItem } from '../client/api';
import { saveAsCsv } from './csvUtils';

export function ComprehensiveListPage() {
  const [rows, setRows] = useState<BacklogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [pendingSaves, setPendingSaves] = useState<Record<string, NodeJS.Timeout | number>>({});
  const [sortOrder, setSortOrder] = useState<'oldest' | 'newest'>(() => {
    const v = (typeof localStorage !== 'undefined' && localStorage.getItem('list.sort')) || 'oldest';
    return (v === 'newest' ? 'newest' : 'oldest');
  });

  function scheduleSave(id: string, patch: Parameters<typeof updateBacklogItem>[1], delay = 600) {
    // Clear any pending timer for this id
    const key = id + ':' + Object.keys(patch).sort().join(',');
    const existing = pendingSaves[key];
    if (existing) {
      clearTimeout(existing as number);
    }
    const t = setTimeout(async () => {
      setSavingId(id);
      try {
        const updated = await updateBacklogItem(id, patch as any);
        setRows(prev => prev.map(it => it.id === id ? { ...it, ...updated } : it));
      } catch (err: any) {
        console.error('Autosave failed', err);
        setError(err?.message || String(err));
      } finally {
        setSavingId(null);
        setPendingSaves(ps => { const cp = { ...ps }; delete cp[key]; return cp; });
      }
    }, delay) as any;
    setPendingSaves(ps => ({ ...ps, [key]: t }));
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const data = await getBacklog();
        if (!cancelled) setRows(data);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    // Always hide soft-deleted/archived items
    const active = rows.filter(r => !r.isRemoved);
    const base = q ? active.filter(r => (
      (r.patientName + ' ' + r.procedure + ' ' + r.mrn + ' ' + (r.phone1 || '') + ' ' + (r.phone2 || '') + ' ' + (r.notes || '')).toLowerCase().includes(q)
    )) : active;
    const sorted = [...base].sort((a, b) => {
      const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const db = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return da - db; // chronological (oldest first)
    });
    return sortOrder === 'oldest' ? sorted : sorted.reverse();
  }, [rows, search, sortOrder]);

  return (
    <div style={{ padding: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <strong>Comprehensive List</strong>
        <input placeholder="Search MRN, name, procedure" value={search} onChange={(e) => setSearch(e.target.value)} />
        <button
          onClick={() => {
            setSortOrder(prev => {
              const next = prev === 'oldest' ? 'newest' : 'oldest';
              try { localStorage.setItem('list.sort', next); } catch {}
              return next;
            });
          }}
          title="Toggle sort order"
          style={{ padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface-1)', cursor: 'pointer' }}
        >
          Sort: {sortOrder === 'oldest' ? 'Oldest → Newest' : 'Newest → Oldest'}
        </button>
        <button
          onClick={() => {
            const rows = filtered.map((r, i) => ({
              index: i + 1,
              createdAt: r.createdAt || '',
              mrn: r.mrn,
              patientName: r.patientName,
              procedure: r.procedure,
              category: r.categoryKey || '',
              priority: (r.caseTypeId || '').replace(/^case:/, ''),
              minutes: r.estDurationMin,
              phone1: r.phone1 || '',
              phone2: r.phone2 || '',
              notes: (r.notes || '').replace(/\n/g, ' '),
            }));
            saveAsCsv(rows, 'backlog_list.csv');
          }}
          title="Export current list to CSV"
          style={{ padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface-1)', cursor: 'pointer' }}
        >
          Export CSV
        </button>
        <span style={{ opacity: 0.7, fontSize: 12 }}>{filtered.length} total</span>
      </div>
      {loading && <div>Loading…</div>}
      {error && <div style={{ color: '#a11' }}>Error: {error}</div>}
      {!loading && !error && (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', padding: 6 }}>#</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', padding: 6 }}>Date added</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', padding: 6 }}>MRN</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', padding: 6 }}>Patient</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', padding: 6 }}>Procedure</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', padding: 6 }}>Category</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', padding: 6 }}>Priority</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', padding: 6 }}>Minutes</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', padding: 6 }}>Contacts</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', padding: 6 }}>Notes</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, idx) => (
              <tr key={r.id}>
                <td style={{ borderBottom: '1px solid var(--border)', padding: 6 }}>{idx + 1}</td>
                <td style={{ borderBottom: '1px solid var(--border)', padding: 6 }}>{r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '—'}</td>
                <td style={{ borderBottom: '1px solid var(--border)', padding: 6 }}>{r.mrn}</td>
                <td style={{ borderBottom: '1px solid var(--border)', padding: 6 }}>
                  {r.patientName}
                  {savingId === r.id && (
                    <span style={{ marginLeft: 8, fontSize: 12, opacity: 0.7 }} aria-live="polite">Saving…</span>
                  )}
                </td>
                <td style={{ borderBottom: '1px solid var(--border)', padding: 6 }}>{r.procedure}</td>
                <td style={{ borderBottom: '1px solid var(--border)', padding: 6 }}>{r.categoryKey || '—'}</td>
                <td style={{ borderBottom: '1px solid var(--border)', padding: 6 }}>{(r.caseTypeId || '').replace(/^case:/, '') || '—'}</td>
                <td style={{ borderBottom: '1px solid var(--border)', padding: 6 }}>{r.estDurationMin}</td>
                <td style={{ borderBottom: '1px solid var(--border)', padding: 6, minWidth: 220 }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      aria-label="Phone 1"
                      value={r.phone1 || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setRows(prev => prev.map(it => it.id === r.id ? { ...it, phone1: val || undefined } : it));
                        scheduleSave(r.id, { phone1: (val || null) });
                      }}
                      style={{ width: 120 }}
                    />
                    <input
                      aria-label="Phone 2"
                      value={r.phone2 || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setRows(prev => prev.map(it => it.id === r.id ? { ...it, phone2: val || undefined } : it));
                        scheduleSave(r.id, { phone2: (val || null) });
                      }}
                      style={{ width: 120 }}
                    />
                  </div>
                </td>
                <td style={{ borderBottom: '1px solid var(--border)', padding: 6, minWidth: 320 }}>
                  <textarea
                    aria-label="Notes"
                    rows={2}
                    value={r.notes || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setRows(prev => prev.map(it => it.id === r.id ? { ...it, notes: val || undefined } : it));
                      scheduleSave(r.id, { notes: (val || null) });
                    }}
                    style={{ width: '100%', resize: 'vertical' }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
