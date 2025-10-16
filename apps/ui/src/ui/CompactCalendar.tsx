import React, { useMemo } from 'react';
import type { ScheduleEntry, BacklogItem } from '../client/api';

type ViewMode = 'day' | 'week' | 'month';

export type DropData = { itemId?: string; estDurationMin?: number; surgeonId?: string };

export type CompactCalendarDrop = {
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  data?: DropData;
};

export function CompactCalendar(props: {
  date: string;
  view?: ViewMode;
  entries: ScheduleEntry[];
  onDrop: (info: CompactCalendarDrop) => void | Promise<void>;
  onRemoveEntry?: (id: string) => void | Promise<void>; // Prefixing unused parameter
  canEdit?: boolean;
  itemById?: Record<string, BacklogItem | undefined>;
  onToggleConfirm?: (id: string, confirmed: boolean) => void | Promise<void>;
  onToggleOperated?: (id: string, operated: boolean) => void | Promise<void>;
}) {
  const { date, view = 'week', entries, onDrop, onRemoveEntry, canEdit = true, itemById, onToggleConfirm, onToggleOperated } = props;

  const days: string[] = useMemo(() => buildDays(date, view), [date, view]);
  const gridTemplateColumns = view === 'day'
    ? 'repeat(1, minmax(360px, 1fr))'
    : 'repeat(7, minmax(160px, 1fr))';

  function handleDrop(e: React.DragEvent<HTMLDivElement>, day: string) {
    e.preventDefault();
    e.stopPropagation();
    const data = parseDragData(e.dataTransfer);
    if (!data?.itemId) return;

    // Compute sequential time window for the day (no overlap)
    const dayEntries = entries.filter((en) => en.date === day).sort((a, b) => a.startTime.localeCompare(b.startTime));
    const base = '08:00';
    const slotMin = 30;
    const durationMin = data.estDurationMin && data.estDurationMin > 0 ? data.estDurationMin : slotMin;
    let start = base;
    if (dayEntries.length > 0) {
      // place after the last end time
      start = dayEntries[dayEntries.length - 1].endTime || base;
    }
    const end = addMinutes(start, durationMin);

    void onDrop({ date: day, startTime: start, endTime: end, data });
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns, gap: 8, height: '100%', overflow: 'auto' }}
         onDragOver={(e) => { e.preventDefault(); }}>
      {days.map((d) => {
        const list = entries
          .filter((en) => en.date === d)
          .sort((a, b) => a.startTime.localeCompare(b.startTime));
        return (
          <div key={d}
               onDrop={(e) => handleDrop(e, d)}
               style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 8, minHeight: 120, background: 'var(--surface-1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <strong>{d}</strong>
              <span style={{ opacity: 0.6, fontSize: 12 }}>{list.length}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {list.map((en) => (
                <div key={en.id}
                     draggable={false}
                     style={{
                       border: '1px solid var(--border)',
                       borderRadius: 6,
                       padding: '6px 8px',
                       background: 'var(--surface-2)',
                       fontSize: 13
                     }}>
                  {(() => {
                    const item = itemById ? itemById[en.waitingListItemId] : undefined;
                    const start = en.startTime;
                    const end = en.endTime;
                    const time = `${start}–${end}`;
                    const dur = durationLabel(start, end);
                    return (
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                          <strong style={{ fontSize: 12 }}>{time}</strong>
                          <span style={{ opacity: 0.6 }}>{dur}</span>
                        </div>
                        <div style={{ marginTop: 2 }}>
                          <div style={{ fontWeight: 600 }}>{item?.patientName ?? 'Patient'}</div>
                          <div style={{ opacity: 0.8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item?.procedure ?? 'Scheduled case'}</div>
                          <div style={{ fontSize: 12, opacity: 0.7 }}>Surgeon: {en.surgeonId}</div>
                        </div>
                        {canEdit && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                            {(() => {
                              const isOperated = (en.status || 'tentative') === 'operated';
                              const isConfirmed = isOperated || (en.status || 'tentative') === 'confirmed';
                              return (
                                <>
                                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                                    <input
                                      type="checkbox"
                                      checked={isConfirmed}
                                      disabled={isOperated}
                                      onChange={(e) => onToggleConfirm?.(en.id, e.target.checked)}
                                    />
                                    Confirmed
                                  </label>
                                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                                    <input
                                      type="checkbox"
                                      checked={isOperated}
                                      disabled={!isConfirmed && !isOperated}
                                      onChange={(e) => onToggleOperated?.(en.id, e.target.checked)}
                                    />
                                    Operated
                                  </label>
                                </>
                              );
                            })()}
                            {onRemoveEntry && (
                              <div style={{ marginLeft: 'auto' }}>
                                <button onClick={() => onRemoveEntry(en.id)} style={{ fontSize: 12 }}>Remove</button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function parseDragData(dt: DataTransfer): DropData | undefined {
  try {
    const json = dt.getData('application/json') || dt.getData('text/plain') || dt.getData('text');
    if (json) return JSON.parse(json);
  } catch {
    // ignore
  }
  return undefined;
}

function addMinutes(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(':').map((v) => parseInt(v, 10));
  const total = h * 60 + m + minutes;
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function durationLabel(start: string, end: string): string {
  const [sh, sm] = start.split(':').map((v) => parseInt(v, 10));
  const [eh, em] = end.split(':').map((v) => parseInt(v, 10));
  let diff = (eh * 60 + em) - (sh * 60 + sm);
  if (diff < 0) diff += 24 * 60;
  return `${diff}m`;
}

function buildDays(anchor: string, view: ViewMode): string[] {
  const date = new Date(anchor + 'T00:00:00');
  const result: string[] = [];
  if (view === 'day') {
    result.push(fmt(date));
  } else if (view === 'week') {
    const d = new Date(date);
    const day = d.getDay(); // 0 Sun .. 6 Sat
    const diffToMon = ((day + 6) % 7); // days since Monday
    d.setDate(d.getDate() - diffToMon);
    for (let i = 0; i < 7; i++) {
      const cur = new Date(d);
      cur.setDate(d.getDate() + i);
      result.push(fmt(cur));
    }
  } else {
    // month grid (start from 1st, back to Monday, produce 5-6 weeks)
    const first = new Date(date.getFullYear(), date.getMonth(), 1);
    const startDay = ((first.getDay() + 6) % 7); // Monday=0
    const start = new Date(first);
    start.setDate(first.getDate() - startDay);
    for (let i = 0; i < 42; i++) {
      const cur = new Date(start);
      cur.setDate(start.getDate() + i);
      result.push(fmt(cur));
    }
  }
  return result;
}

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}
