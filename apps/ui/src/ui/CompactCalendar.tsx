import React, { useMemo, useState } from 'react';
import type { ScheduleEntry, BacklogItem } from '../client/api';

type ViewMode = 'day' | 'week' | 'month';

// ============================================================================
// CONSTANTS & STYLE DEFINITIONS (Phase 1 Refactoring)
// ============================================================================

/** Month view styling constants */
const MONTH_VIEW = {
  COMPACT_HEIGHT: 120,
  EXPANDED_HEIGHT: 320,
  PADDING: 12,
  HEADER_MARGIN_BOTTOM: 10,
  HEADER_PADDING_BOTTOM: 10,
  ENTRIES_GAP: 8,
  CARD_COMPACT_PADDING: '6px 8px',
  CARD_EXPANDED_PADDING: 10,
  CASE_BADGE_FONT_SIZE: 13,
  DATE_FONT_SIZE: 16,
  MIN_COL_WIDTH: 200,
} as const;

/** Week view styling constants */
const WEEK_VIEW = {
  HEIGHT: 120,
  PADDING: 8,
  HEADER_MARGIN_BOTTOM: 6,
  ENTRIES_GAP: 6,
  CASE_BADGE_FONT_SIZE: 12,
  DATE_FONT_SIZE: 14,
  MIN_COL_WIDTH: 160,
} as const;

/** Day view styling constants */
const DAY_VIEW = {
  HEIGHT: 120,
  PADDING: 8,
  MIN_COL_WIDTH: 360,
} as const;

/** Status color scheme */
const STATUS_COLORS = {
  operated: {
    bg: '#DCFCE7',
    border: '#16a34a',
    badge: '#047857',
    name: 'Operated',
  },
  confirmed: {
    bg: '#E6F4EA',
    border: '#84cc16',
    badge: '#65a30d',
    name: 'Confirmed',
  },
  tentative: {
    bg: '#FEF3C7',
    border: '#F59E0B',
    badge: '#b45309',
    name: 'Tentative',
  },
} as const;

type StatusKey = keyof typeof STATUS_COLORS;

/** Animation & transition durations */
const ANIMATIONS = {
  TRANSITION_FAST: '0.2s ease',
  TRANSITION_MEDIUM: '0.3s ease',
  TRANSITION_SLOW: '0.15s ease',
} as const;

// Helper function to get status colors
function getStatusColors(status?: string): (typeof STATUS_COLORS)[StatusKey] {
  const key = (status === 'operated' || status === 'confirmed' ? status : 'tentative') as StatusKey;
  return STATUS_COLORS[key];
}

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
  onRemoveEntry?: (id: string) => void | Promise<void>;
  canEdit?: boolean;
  itemById?: Record<string, BacklogItem | undefined>;
  onToggleConfirm?: (id: string, confirmed: boolean) => void | Promise<void>;
  onToggleOperated?: (id: string, operated: boolean) => void | Promise<void>;
}) {
  const { date, view = 'week', entries, onDrop, onRemoveEntry, canEdit = true, itemById, onToggleConfirm, onToggleOperated } = props;
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

  // View flags for cleaner conditional logic
  const isMonthView = view === 'month';
  const isWeekView = view === 'week';
  const isDayView = view === 'day';

  const toggleDayExpand = (dayDate: string) => {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(dayDate)) {
        next.delete(dayDate);
      } else {
        next.add(dayDate);
      }
      return next;
    });
  };

  const days: string[] = useMemo(() => buildDays(date, view), [date, view]);
  const anchorDate = useMemo(() => new Date(`${date}T00:00:00Z`), [date]);
  const anchorYear = anchorDate.getUTCFullYear();
  const anchorMonthIndex = anchorDate.getUTCMonth();

  // Grid layout based on view mode
  const gridTemplateColumns = isMonthView
    ? `repeat(7, minmax(${MONTH_VIEW.MIN_COL_WIDTH}px, 1fr))`
    : isWeekView
    ? `repeat(7, minmax(${WEEK_VIEW.MIN_COL_WIDTH}px, 1fr))`
    : `repeat(1, minmax(${DAY_VIEW.MIN_COL_WIDTH}px, 1fr))`;

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
    <div
      style={{
        display: 'grid',
        gridTemplateColumns,
        gap: 8,
        height: '100%',
        overflow: 'auto',
      }}
      onDragOver={(e) => { e.preventDefault(); }}
    >
      {days.map((d) => {
        const cellDate = new Date(`${d}T00:00:00Z`);
        const isCurrentMonth = cellDate.getUTCFullYear() === anchorYear && cellDate.getUTCMonth() === anchorMonthIndex;
        const list = isCurrentMonth
          ? entries
              .filter((en) => en.date === d)
              .sort((a, b) => a.startTime.localeCompare(b.startTime))
          : [];

        if (view === 'month' && !isCurrentMonth) {
          return (
            <div
              key={d}
              aria-hidden
              style={{
                border: 'none',
                borderRadius: 8,
                padding: 8,
                minHeight: 120,
                background: 'transparent',
              }}
            />
          );
        }

        // Month view: determine if expanded
        const isExpanded = view === 'month' && expandedDays.has(d);
        const minHeightMonth = isExpanded ? 320 : 120;

        return (
          <div key={d}
               onDrop={(e) => handleDrop(e, d)}
               style={{
                 border: '1px solid var(--border)',
                 borderRadius: 10,
                 padding: view === 'month' ? 12 : 8,
                 minHeight: view === 'month' ? minHeightMonth : 120,
                 background: 'var(--surface-1)',
                 display: 'flex',
                 flexDirection: 'column',
                 transition: 'box-shadow 0.2s ease, transform 0.2s ease, min-height 0.3s ease',
                 boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
               }}
               onMouseEnter={(e) => {
                 if (view === 'month') {
                   e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.12)';
                   e.currentTarget.style.transform = 'translateY(-2px)';
                 }
               }}
               onMouseLeave={(e) => {
                 if (view === 'month') {
                   e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)';
                   e.currentTarget.style.transform = 'translateY(0)';
                 }
               }}
               >
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: view === 'month' ? 10 : 6,
              paddingBottom: view === 'month' ? 10 : 0,
              borderBottom: view === 'month' ? '2px solid var(--border)' : 'none',
            }}>
              <strong style={{ fontSize: view === 'month' ? 16 : 14 }}>{d}</strong>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  fontSize: view === 'month' ? 13 : 12,
                  fontWeight: 500,
                  opacity: 0.6,
                  background: view === 'month' ? 'var(--surface-2)' : 'transparent',
                  padding: view === 'month' ? '2px 8px' : '0',
                  borderRadius: 4,
                }}>
                  {list.length} {view === 'month' ? (list.length === 1 ? 'case' : 'cases') : `(${list.length})`}
                </span>
                {view === 'month' && (
                  <button
                    onClick={() => toggleDayExpand(d)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 20,
                      height: 20,
                      color: 'var(--text)',
                      opacity: 0.7,
                      transition: 'opacity 0.2s ease, transform 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.opacity = '1';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.opacity = '0.7';
                    }}
                    title={isExpanded ? 'Collapse' : 'Expand'}
                  >
                    <span style={{
                      fontSize: 14,
                      transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s ease',
                    }}>
                      ▼
                    </span>
                  </button>
                )}
              </div>
            </div>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: view === 'month' ? 8 : 6,
              flex: 1,
              overflowY: view === 'month' ? 'auto' : 'visible',
            }}>
              {list.map((en) => {
                const isOperated = (en.status || 'tentative') === 'operated';
                const isConfirmed = isOperated || (en.status || 'tentative') === 'confirmed';
                const cardBg = view === 'month'
                  ? (isOperated ? '#DCFCE7' : isConfirmed ? '#E6F4EA' : '#FEF3C7')
                  : 'var(--surface-2)';
                const borderColor = view === 'month'
                  ? (isOperated ? '#16a34a' : isConfirmed ? '#84cc16' : '#F59E0B')
                  : 'var(--border)';
                const statusColor = isOperated ? '#047857' : isConfirmed ? '#65a30d' : '#b45309';

                // Compact vs expanded layout
                const showCompactLayout = view === 'month' && !isExpanded;

                return (
                <div key={en.id}
                     draggable={false}
                     style={{
                       border: `${view === 'month' ? '1.5px' : '1px'} solid ${borderColor}`,
                       borderRadius: 6,
                       padding: view === 'month' ? (showCompactLayout ? '6px 8px' : 10) : '6px 8px',
                       background: cardBg,
                       fontSize: view === 'month' ? 12 : 13,
                       transition: 'transform 0.15s ease, box-shadow 0.15s ease, padding 0.3s ease',
                     }}
                     onMouseEnter={(e) => {
                       if (view === 'month') {
                         e.currentTarget.style.transform = 'scale(1.02)';
                         e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
                       }
                     }}
                     onMouseLeave={(e) => {
                       if (view === 'month') {
                         e.currentTarget.style.transform = 'scale(1)';
                         e.currentTarget.style.boxShadow = '0 0 0 transparent';
                       }
                     }}
                     >
                  {(() => {
                    const item = itemById ? itemById[en.waitingListItemId] : undefined;
                    const start = en.startTime;
                    const end = en.endTime;
                    const time = `${start}–${end}`;
                    const dur = durationLabel(start, end);

                    // Compact layout: minimal info
                    if (showCompactLayout) {
                      return (
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 4 }}>
                            <strong style={{ fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>{start}</strong>
                            <span style={{ fontSize: 10, opacity: 0.6, fontStyle: 'italic' }}>{dur}</span>
                          </div>
                          <div style={{
                            fontSize: 11,
                            fontWeight: 500,
                            marginTop: 2,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}>
                            {item?.patientName ?? 'Patient'}
                          </div>
                        </div>
                      );
                    }

                    // Expanded layout: full details
                    return (
                      <div>
                        {view === 'month' && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6, gap: 8 }}>
                            <strong style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{time}</strong>
                            <span style={{
                              fontSize: 10,
                              fontWeight: 600,
                              padding: '2px 6px',
                              borderRadius: 3,
                              background: statusColor,
                              color: 'white',
                              textTransform: 'capitalize',
                              whiteSpace: 'nowrap',
                            }}>
                              {en.status || 'tentative'}
                            </span>
                          </div>
                        )}
                        {view !== 'month' && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                            <strong style={{ fontSize: 12 }}>{time}</strong>
                            <span style={{ opacity: 0.6 }}>{dur}</span>
                          </div>
                        )}
                        <div style={{ marginTop: view === 'month' ? 4 : 2 }}>
                          <div style={{ fontWeight: view === 'month' ? 700 : 600, fontSize: view === 'month' ? 13 : 12 }}>{item?.patientName ?? 'Patient'}</div>
                          <div style={{
                            opacity: view === 'month' ? 0.85 : 0.8,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            fontSize: view === 'month' ? 11 : 12,
                            marginBottom: view === 'month' ? 4 : 0,
                          }}>
                            {item?.procedure ?? 'Scheduled case'}
                          </div>
                          {item?.entryDate && (
                            <div style={{ fontSize: 10, opacity: view === 'month' ? 0.65 : 0.6, marginBottom: 4 }}>
                              Entered: {new Date(item.entryDate).toLocaleDateString()}
                            </div>
                          )}
                          <div style={{ fontSize: view === 'month' ? 11 : 12, opacity: view === 'month' ? 0.75 : 0.7 }}>
                            <strong>OR {en.roomId}</strong>
                            {' · '}
                            Surgeon: {en.surgeonId}
                          </div>
                        </div>
                        {canEdit && (
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            marginTop: view === 'month' ? 8 : 6,
                            flexWrap: 'wrap',
                            width: '100%',
                            ...(view === 'month' ? { paddingTop: 8, borderTop: '1px solid rgba(0,0,0,0.05)' } : {}),
                          }}>
                            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                              <input
                                type="checkbox"
                                checked={isConfirmed}
                                disabled={isOperated}
                                onChange={(e) => onToggleConfirm?.(en.id, e.target.checked)}
                              />
                              <span>Confirmed</span>
                            </label>
                            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                              <input
                                type="checkbox"
                                checked={isOperated}
                                disabled={!isConfirmed && !isOperated}
                                onChange={(e) => onToggleOperated?.(en.id, e.target.checked)}
                              />
                              <span>Operated</span>
                            </label>
                            {onRemoveEntry && (
                              <button
                                onClick={() => onRemoveEntry(en.id)}
                                style={{ fontSize: 11, marginLeft: 'auto', padding: '4px 8px' }}
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
                );
              })}
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
