import { useCallback, useEffect, useMemo, useState } from 'react';
import { getScheduleRange, ScheduleEntry } from '../client/api';

function startOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function addMonths(date: Date, delta: number): Date {
  const d = new Date(date);
  d.setUTCMonth(d.getUTCMonth() + delta);
  return d;
}

function formatDateUTC(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseMonth(value: string): Date | null {
  const [y, m] = value.split('-').map(Number);
  if (!y || Number.isNaN(y) || !m || Number.isNaN(m)) return null;
  return new Date(Date.UTC(y, m - 1, 1));
}

type DayBucket = {
  date: string;
  entries: ScheduleEntry[];
};

export function MonthlySchedulePage() {
  const [month, setMonth] = useState(() => {
    const today = startOfMonth(new Date());
    return formatDateUTC(today);
  });
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const monthDate = useMemo(() => parseMonth(month) ?? startOfMonth(new Date()), [month]);
  const nextMonthDate = useMemo(() => addMonths(monthDate, 1), [monthDate]);
  const label = useMemo(() => monthDate.toLocaleString(undefined, { month: 'long', year: 'numeric' }), [monthDate]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const start = formatDateUTC(monthDate);
      const end = formatDateUTC(nextMonthDate);
      const data = await getScheduleRange({ start, end });
      setEntries(data.filter(entry => entry.status !== 'cancelled'));
    } catch (e: any) {
      setError(e?.message || 'Failed to load monthly schedule');
    } finally {
      setLoading(false);
    }
  }, [monthDate, nextMonthDate]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const days = useMemo<DayBucket[]>(() => {
    const map = new Map<string, ScheduleEntry[]>();
    for (const entry of entries) {
      if (!entry.date) continue;
      const list = map.get(entry.date) ?? [];
      list.push(entry);
      map.set(entry.date, list);
    }
    const out = Array.from(map.entries())
      .map(([date, list]) => ({
        date,
        entries: list.sort((a, b) => a.startTime.localeCompare(b.startTime)),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
    return out;
  }, [entries]);

  const hasData = days.length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 12, gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button onClick={() => setMonth(formatDateUTC(addMonths(monthDate, -1)))} aria-label="Previous month">◀</button>
        <strong>{label}</strong>
        <button onClick={() => setMonth(formatDateUTC(addMonths(monthDate, 1)))} aria-label="Next month">▶</button>
        <div style={{ marginLeft: 'auto', fontSize: 12, opacity: 0.75 }}>
          {hasData ? `${days.length} day${days.length === 1 ? '' : 's'} with scheduled cases` : 'No scheduled cases this month'}
        </div>
      </div>
      {error && <div style={{ color: '#b91c1c' }}>{error}</div>}
      {loading ? (
        <div>Loading monthly schedule…</div>
      ) : hasData ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignContent: 'flex-start', overflowY: 'auto' }}>
          {days.map(day => (
            <div
              key={day.date}
              style={{
                minWidth: 240,
                flex: '1 1 240px',
                border: '1px solid var(--border)',
                borderRadius: 8,
                background: 'var(--surface-1)',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong>{day.date}</strong>
                <span style={{ fontSize: 12, opacity: 0.7 }}>{day.entries.length}</span>
              </div>
              <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {day.entries.map(entry => {
                  const status = entry.status || 'scheduled';
                  const patient = entry.patientName || entry.waitingListItemId || 'Patient';
                  const procedure = entry.procedure || 'Scheduled case';
                  const surgeon = entry.surgeonId || '—';
                  return (
                    <div key={entry.id} style={{ border: '1px solid var(--border)', borderRadius: 6, padding: 8, background: 'var(--surface-2)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                        <strong>{entry.startTime}–{entry.endTime}</strong>
                        <span style={{ opacity: 0.7 }}>{status}</span>
                      </div>
                      <div style={{ marginTop: 4 }}>
                        <div style={{ fontWeight: 600 }}>{patient}</div>
                        <div style={{ fontSize: 12, opacity: 0.8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {procedure}
                        </div>
                        <div style={{ fontSize: 12, opacity: 0.7 }}>Surgeon: {surgeon}</div>
                      </div>
                      {entry.notes && (
                        <div style={{ fontSize: 11, marginTop: 6, opacity: 0.75 }}>
                          Notes: {entry.notes}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div>No scheduled cases in this month.</div>
      )}
    </div>
  );
}
