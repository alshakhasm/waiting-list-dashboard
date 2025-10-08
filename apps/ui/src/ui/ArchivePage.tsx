import { useEffect, useMemo, useState } from 'react';
import { getArchivedPatients, ArchivedPatient } from '../client/api';
import { saveAsCsv } from './csvUtils';

export function ArchivePage() {
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<ArchivedPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const data = await getArchivedPatients({ search });
        if (!cancelled) setRows(data);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [search]);

  const total = useMemo(() => rows.reduce((acc, r) => acc + (r.totalBacklogEntries || 0), 0), [rows]);

  return (
    <div style={{ padding: 8 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
        <strong>Archive</strong>
        <input placeholder="Search MRN or name" value={search} onChange={(e) => setSearch(e.target.value)} />
        <button
          onClick={() => {
            const out = rows.map((r: ArchivedPatient) => ({
              mrn: r.mrn,
              lastPatientName: r.lastPatientName || '',
              firstSeenAt: r.firstSeenAt,
              lastSeenAt: r.lastSeenAt,
              totalBacklogEntries: r.totalBacklogEntries,
              lastCategoryKey: r.lastCategoryKey || '',
              lastPriority: (r.lastCaseTypeId || '').replace(/^case:/, ''),
              lastProcedure: r.lastProcedure || '',
            }));
            saveAsCsv(out, 'patients_archive.csv');
          }}
          title="Export archive to CSV"
          style={{ padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface-1)', cursor: 'pointer' }}
        >
          Export CSV
        </button>
        <span style={{ opacity: 0.7, fontSize: 12 }}>{rows.length} patients · {total} backlog entries</span>
      </div>
      {loading && <div>Loading archive…</div>}
      {error && <div style={{ color: '#a11' }}>Error: {error}</div>}
      {!loading && !error && (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', padding: 6 }}>MRN</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', padding: 6 }}>Name</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', padding: 6 }}>First seen</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', padding: 6 }}>Last seen</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', padding: 6 }}>Total entries</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', padding: 6 }}>Last category</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', padding: 6 }}>Last priority</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', padding: 6 }}>Last procedure</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.mrn}>
                <td style={{ borderBottom: '1px solid var(--border)', padding: 6 }}>{r.mrn}</td>
                <td style={{ borderBottom: '1px solid var(--border)', padding: 6 }}>{r.lastPatientName || '—'}</td>
                <td style={{ borderBottom: '1px solid var(--border)', padding: 6 }}>{new Date(r.firstSeenAt).toLocaleDateString()}</td>
                <td style={{ borderBottom: '1px solid var(--border)', padding: 6 }}>{new Date(r.lastSeenAt).toLocaleDateString()}</td>
                <td style={{ borderBottom: '1px solid var(--border)', padding: 6 }}>{r.totalBacklogEntries}</td>
                <td style={{ borderBottom: '1px solid var(--border)', padding: 6 }}>{r.lastCategoryKey || '—'}</td>
                <td style={{ borderBottom: '1px solid var(--border)', padding: 6 }}>{(r.lastCaseTypeId || '').replace(/^case:/, '') || '—'}</td>
                <td style={{ borderBottom: '1px solid var(--border)', padding: 6 }}>{r.lastProcedure || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
