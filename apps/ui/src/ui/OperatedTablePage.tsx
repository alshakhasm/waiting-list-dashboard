import { useEffect, useMemo, useState } from 'react';
import { BacklogItem, ScheduleEntry, getBacklog, getSchedule } from '../client/api';

type Row = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  durationMin: number;
  patientName: string;
  procedure: string;
  surgeonId: string;
  roomId: string;
  status: string;
};

function toMinutes(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let diff = (eh * 60 + em) - (sh * 60 + sm);
  if (diff < 0) diff += 24 * 60;
  return diff;
}

function parseDate(value: string | null | undefined, fallback: Date): Date {
  if (!value) return fallback;
  const date = new Date(value + 'T00:00:00');
  return Number.isNaN(date.getTime()) ? fallback : date;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function OperatedTablePage() {
  const [from, setFrom] = useState(() => formatDate(new Date(Date.now() - 14 * 86400000)));
  const [to, setTo] = useState(() => formatDate(new Date(Date.now() + 180 * 86400000)));
  const [items, setItems] = useState<BacklogItem[]>([]);
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [bl, sc] = await Promise.all([
        getBacklog(),
        getSchedule(),
      ]);
      setItems(bl);
      setSchedule(sc);
      setLoading(false);
    })();
  }, []);

  const itemById = useMemo(() => Object.fromEntries(items.map(i => [i.id, i])), [items]);

  const rows: Row[] = useMemo(() => {
    const f = parseDate(from, new Date(0));
    const t = parseDate(to, new Date(Date.now() + 10 * 365 * 86400000));
    return schedule
      .filter(e => e.status === 'operated')
      .filter(e => {
        const d = new Date(e.date + 'T00:00:00');
        return d >= f && d <= t;
      })
      .map(e => {
        const it = itemById[e.waitingListItemId];
        return {
          id: e.id,
          date: e.date,
          startTime: e.startTime,
          endTime: e.endTime,
          durationMin: toMinutes(e.startTime, e.endTime),
          patientName: it?.patientName ?? '—',
          procedure: it?.procedure ?? '—',
          surgeonId: e.surgeonId,
          roomId: e.roomId,
          status: e.status,
        } as Row;
      })
      .sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));
  }, [schedule, itemById, from, to]);

  if (loading) return <div>Loading…</div>;
  return (
    <div style={{ padding: 0 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
        <strong>Operated cases</strong>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>From <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>To <input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        </div>
      </div>
      <div style={{ overflow: 'auto', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface-1)' }}>
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead style={{ background: 'var(--surface-3)' }}>
            <tr>
              <th style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>Date</th>
              <th style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>Duration</th>
              <th style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>Patient</th>
              <th style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>Procedure</th>
              <th style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>Surgeon</th>
              <th style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>Room</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 12, opacity: 0.7 }}>No operated cases in the selected period.</td></tr>
            ) : rows.map(r => (
              <tr key={r.id}>
                <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>{r.date}</td>
                <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>{r.durationMin}m</td>
                <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>{r.patientName}</td>
                <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', maxWidth: 420, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.procedure}</td>
                <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>{r.surgeonId}</td>
                <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>{r.roomId}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
