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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16, alignContent: 'flex-start', overflowY: 'auto' }}>
          {days.map(day => (
            <div
              key={day.date}
              style={{
                border: '1px solid var(--border)',
                borderRadius: 10,
                background: 'var(--surface-1)',
                display: 'flex',
                flexDirection: 'column',
                minHeight: 320,
                transition: 'box-shadow 0.2s ease, transform 0.2s ease',
                boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.12)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <div style={{ padding: '14px 16px', borderBottom: '2px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-0)' }}>
                <div>
                  <strong style={{ fontSize: 16, letterSpacing: '0.3px' }}>{day.date}</strong>
                </div>
                <span style={{ fontSize: 13, opacity: 0.6, fontWeight: 500, background: 'var(--surface-2)', padding: '2px 8px', borderRadius: 4 }}>
                  {day.entries.length} case{day.entries.length === 1 ? '' : 's'}
                </span>
              </div>
              <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10, flex: 1, overflowY: 'auto' }}>
                {day.entries.map(entry => {
                  const status = entry.status || 'scheduled';
                  const patient = entry.patientName || entry.waitingListItemId || 'Patient';
                  const procedure = entry.procedure || 'Scheduled case';
                  const surgeon = entry.surgeonId || '—';
                  const isOperated = status === 'operated';
                  const isConfirmed = isOperated || status === 'confirmed';
                  const cardBg = isOperated ? '#DCFCE7' : isConfirmed ? '#E6F4EA' : '#FEF3C7';
                  const borderColor = isOperated ? '#16a34a' : isConfirmed ? '#84cc16' : '#F59E0B';
                  const statusColor = isOperated ? '#047857' : isConfirmed ? '#65a30d' : '#b45309';
                  
                  return (
                    <div
                      key={entry.id}
                      style={{
                        border: `1.5px solid ${borderColor}`,
                        borderRadius: 8,
                        padding: 12,
                        background: cardBg,
                        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'scale(1.02)';
                        e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'scale(1)';
                        e.currentTarget.style.boxShadow = '0 0 0 transparent';
                      }}
                    >
                      {/* Time and Status Badge */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                        <strong style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
                          {entry.startTime}–{entry.endTime}
                        </strong>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            padding: '3px 8px',
                            borderRadius: 4,
                            background: statusColor,
                            color: 'white',
                            textTransform: 'capitalize',
                            letterSpacing: '0.3px',
                          }}
                        >
                          {status}
                        </span>
                      </div>
                      
                      {/* Patient Name */}
                      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6, color: '#111827' }}>
                        {patient}
                      </div>
                      
                      {/* Procedure */}
                      <div
                        style={{
                          fontSize: 12,
                          opacity: 0.85,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          marginBottom: 6,
                          color: '#374151',
                        }}
                        title={procedure}
                      >
                        {procedure}
                      </div>
                      
                      {/* Surgeon */}
                      <div style={{ fontSize: 12, opacity: 0.75, color: '#4b5563', marginBottom: entry.notes ? 6 : 0 }}>
                        <strong>OR {entry.roomId}</strong>
                        {' · Surgeon: '}
                        {surgeon}
                      </div>
                      
                      {/* Notes */}
                      {entry.notes && (
                        <div
                          style={{
                            fontSize: 11,
                            marginTop: 6,
                            opacity: 0.7,
                            paddingTop: 6,
                            borderTop: '1px solid rgba(0,0,0,0.05)',
                            fontStyle: 'italic',
                            color: '#4b5563',
                          }}
                        >
                          📝 {entry.notes}
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
        <div style={{ textAlign: 'center', opacity: 0.6, marginTop: 24 }}>
          <p style={{ fontSize: 14 }}>No scheduled cases in this month.</p>
        </div>
      )}
    </div>
  );
}
