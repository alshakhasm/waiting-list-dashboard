import { useCallback, useEffect, useMemo, useState } from 'react';
import { BacklogItem, ScheduleEntry, getBacklog, getSchedule } from '../client/api';

type Row = {
  item: BacklogItem;
  schedule: ScheduleEntry | null;
  status: 'unscheduled' | 'scheduled' | 'confirmed';
};

function classifyStatus(entry: ScheduleEntry | null): 'unscheduled' | 'scheduled' | 'confirmed' | 'hidden' {
  if (!entry) return 'unscheduled';
  const st = (entry.status || 'tentative').trim().toLowerCase();
  if (st === 'operated' || st === 'completed' || st === 'cancelled') return 'hidden';
  if (st === 'confirmed') return 'confirmed';
  return 'scheduled';
}

function formatDate(date: string | undefined, time?: string): string {
  if (!date) return '—';
  try {
    const iso = time ? `${date}T${time}` : `${date}T00:00:00`;
    const d = new Date(iso);
    return `${d.toLocaleDateString()}${time ? ' ' + time : ''}`;
  } catch {
    return date;
  }
}

export function ComprehensiveListPage({ reloadKey }: { reloadKey: number }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [backlog, schedule] = await Promise.all([getBacklog(), getSchedule()]);
      const scheduleMap = new Map<string, ScheduleEntry>();
      for (const entry of schedule) {
        if (!entry.waitingListItemId) continue;
        if (entry.status === 'cancelled') continue;
        const existing = scheduleMap.get(entry.waitingListItemId);
        const existingTime = existing ? new Date(existing.updatedAt || existing.date).getTime() : -Infinity;
        const nextTime = new Date(entry.updatedAt || entry.date).getTime();
        if (!existing || nextTime >= existingTime) {
          scheduleMap.set(entry.waitingListItemId, entry);
        }
      }
      const mapped: Row[] = backlog
        .filter(item => !item.isRemoved)
        .map(item => {
          const scheduleEntry = scheduleMap.get(item.id) ?? null;
          const status = classifyStatus(scheduleEntry);
          return { item, schedule: scheduleEntry, status };
        })
        .filter(row => row.status !== 'hidden');
      setRows(mapped);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh, reloadKey]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = q
      ? rows.filter(row => {
        const { item, schedule } = row;
        const haystack = [
          item.patientName,
          item.procedure,
          item.mrn,
          item.surgeonId,
          item.notes,
          schedule?.startTime,
          schedule?.endTime,
        ].join(' ').toLowerCase();
        return haystack.includes(q);
      })
      : rows;
    return [...base].sort((a, b) => {
      const da = a.item.createdAt ? new Date(a.item.createdAt).getTime() : 0;
      const db = b.item.createdAt ? new Date(b.item.createdAt).getTime() : 0;
      return da - db;
    });
  }, [rows, search]);

  return (
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <strong>Dashboard List</strong>
        <input
          placeholder="Search patient, procedure, MRN"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ minWidth: 240 }}
        />
        <button onClick={refresh} disabled={loading} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)' }}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
        <span style={{ marginLeft: 'auto', fontSize: 12, opacity: 0.75 }}>{filtered.length} cases</span>
      </div>
      {error && <div style={{ color: '#b91c1c' }}>Error: {error}</div>}
      {loading ? (
        <div>Loading…</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', padding: 8 }}>Patient</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', padding: 8 }}>Procedure</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', padding: 8 }}>MRN</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', padding: 8 }}>Surgeon</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', padding: 8 }}>Schedule</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', padding: 8 }}>Status</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', padding: 8, minWidth: 200 }}>Notes</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(({ item, schedule, status }) => (
              <tr key={item.id}>
                <td style={{ borderBottom: '1px solid var(--border)', padding: 8 }}>{item.patientName}</td>
                <td style={{ borderBottom: '1px solid var(--border)', padding: 8 }}>{item.procedure}</td>
                <td style={{ borderBottom: '1px solid var(--border)', padding: 8 }}>{item.mrn}</td>
                <td style={{ borderBottom: '1px solid var(--border)', padding: 8 }}>{schedule?.surgeonId || item.surgeonId || '—'}</td>
                <td style={{ borderBottom: '1px solid var(--border)', padding: 8 }}>
                  {schedule ? formatDate(schedule.date, schedule.startTime) : 'Not scheduled'}
                </td>
                <td style={{ borderBottom: '1px solid var(--border)', padding: 8 }}>
                  {status === 'confirmed'
                    ? 'Confirmed'
                    : status === 'scheduled'
                      ? 'Awaiting confirmation'
                      : 'Awaiting scheduling'}
                </td>
                <td style={{ borderBottom: '1px solid var(--border)', padding: 8 }}>{item.notes || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
