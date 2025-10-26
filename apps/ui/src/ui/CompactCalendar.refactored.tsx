import React, { useMemo, useState } from 'react';
import type { ScheduleEntry, BacklogItem } from '../client/api';

type ViewMode = 'day' | 'week' | 'month';

export type DropData = { itemId?: string; estDurationMin?: number; surgeonId?: string };

export type CompactCalendarDrop = {
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  data?: DropData;
};

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
    label: 'Operated',
  },
  confirmed: {
    bg: '#E6F4EA',
    border: '#84cc16',
    badge: '#65a30d',
    label: 'Confirmed',
  },
  tentative: {
    bg: '#FEF3C7',
    border: '#F59E0B',
    badge: '#b45309',
    label: 'Tentative',
  },
} as const;

type StatusKey = keyof typeof STATUS_COLORS;

/** Animation & transition durations */
const ANIMATIONS = {
  FAST: '0.2s ease',
  MEDIUM: '0.3s ease',
  SLOW: '0.15s ease',
} as const;

// Helper function to get status colors
function getStatusColors(status?: string): (typeof STATUS_COLORS)[StatusKey] {
  const key = (status === 'operated' || status === 'confirmed' ? status : 'tentative') as StatusKey;
  return STATUS_COLORS[key];
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

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
  const {
    date,
    view = 'week',
    entries,
    onDrop,
    onRemoveEntry,
    canEdit = true,
    itemById,
    onToggleConfirm,
    onToggleOperated,
  } = props;

  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

  // View mode flags for cleaner conditional logic
  const isMonthView = view === 'month';
  const isWeekView = view === 'week';

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
    const dayEntries = entries
      .filter((en) => en.date === day)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
    const base = '08:00';
    const slotMin = 30;
    const durationMin =
      data.estDurationMin && data.estDurationMin > 0 ? data.estDurationMin : slotMin;
    let start = base;
    if (dayEntries.length > 0) {
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
      onDragOver={(e) => {
        e.preventDefault();
      }}
    >
      {days.map((d) => {
        const cellDate = new Date(`${d}T00:00:00Z`);
        const isCurrentMonth =
          cellDate.getUTCFullYear() === anchorYear &&
          cellDate.getUTCMonth() === anchorMonthIndex;
        const list = isCurrentMonth
          ? entries
              .filter((en) => en.date === d)
              .sort((a, b) => a.startTime.localeCompare(b.startTime))
          : [];

        // Skip rendering out-of-month cells in month view
        if (isMonthView && !isCurrentMonth) {
          return (
            <div
              key={d}
              aria-hidden
              style={{
                border: 'none',
                borderRadius: 8,
                padding: 8,
                minHeight: MONTH_VIEW.COMPACT_HEIGHT,
                background: 'transparent',
              }}
            />
          );
        }

        // Determine if day is expanded (month view only)
        const isExpanded = isMonthView && expandedDays.has(d);
        const minHeight = isMonthView
          ? isExpanded
            ? MONTH_VIEW.EXPANDED_HEIGHT
            : MONTH_VIEW.COMPACT_HEIGHT
          : isWeekView
          ? WEEK_VIEW.HEIGHT
          : 120;

        return (
          <DayCell
            key={d}
            date={d}
            entries={list}
            isExpanded={isExpanded}
            isMonthView={isMonthView}
            isWeekView={isWeekView}
            minHeight={minHeight}
            onDrop={handleDrop}
            onToggleDayExpand={toggleDayExpand}
            itemById={itemById}
            canEdit={canEdit}
            onToggleConfirm={onToggleConfirm}
            onToggleOperated={onToggleOperated}
            onRemoveEntry={onRemoveEntry}
          />
        );
      })}
    </div>
  );
}

// ============================================================================
// DAY CELL SUB-COMPONENT (Phase 2 Refactoring)
// ============================================================================

interface DayCellProps {
  date: string;
  entries: ScheduleEntry[];
  isExpanded: boolean;
  isMonthView: boolean;
  isWeekView: boolean;
  minHeight: number;
  onDrop: (e: React.DragEvent<HTMLDivElement>, day: string) => void;
  onToggleDayExpand: (date: string) => void;
  itemById?: Record<string, BacklogItem | undefined>;
  canEdit: boolean;
  onToggleConfirm?: (id: string, confirmed: boolean) => void | Promise<void>;
  onToggleOperated?: (id: string, operated: boolean) => void | Promise<void>;
  onRemoveEntry?: (id: string) => void | Promise<void>;
}

function DayCell({
  date,
  entries,
  isExpanded,
  isMonthView,
  isWeekView,
  minHeight,
  onDrop,
  onToggleDayExpand,
  itemById,
  canEdit,
  onToggleConfirm,
  onToggleOperated,
  onRemoveEntry,
}: DayCellProps) {
  const padding = isMonthView ? MONTH_VIEW.PADDING : WEEK_VIEW.PADDING;
  const headerMarginBottom = isMonthView
    ? MONTH_VIEW.HEADER_MARGIN_BOTTOM
    : WEEK_VIEW.HEADER_MARGIN_BOTTOM;
  const headerPaddingBottom = isMonthView
    ? MONTH_VIEW.HEADER_PADDING_BOTTOM
    : 0;
  const entriesGap = isMonthView ? MONTH_VIEW.ENTRIES_GAP : WEEK_VIEW.ENTRIES_GAP;
  const dateFontSize = isMonthView ? MONTH_VIEW.DATE_FONT_SIZE : WEEK_VIEW.DATE_FONT_SIZE;
  const caseBadgeFontSize = isMonthView
    ? MONTH_VIEW.CASE_BADGE_FONT_SIZE
    : WEEK_VIEW.CASE_BADGE_FONT_SIZE;

  return (
    <div
      onDrop={(e) => onDrop(e, date)}
      style={{
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding,
        minHeight,
        background: 'var(--surface-1)',
        display: 'flex',
        flexDirection: 'column',
        transition: `box-shadow ${ANIMATIONS.FAST}, transform ${ANIMATIONS.FAST}, min-height ${ANIMATIONS.MEDIUM}`,
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      }}
      onMouseEnter={(e) => {
        if (isMonthView) {
          e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.12)';
          e.currentTarget.style.transform = 'translateY(-2px)';
        }
      }}
      onMouseLeave={(e) => {
        if (isMonthView) {
          e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)';
          e.currentTarget.style.transform = 'translateY(0)';
        }
      }}
    >
      <DayCellHeader
        date={date}
        caseCount={entries.length}
        isExpanded={isExpanded}
        isMonthView={isMonthView}
        marginBottom={headerMarginBottom}
        paddingBottom={headerPaddingBottom}
        dateFontSize={dateFontSize}
        caseBadgeFontSize={caseBadgeFontSize}
        onToggleExpand={() => onToggleDayExpand(date)}
      />

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: entriesGap,
          flex: 1,
          overflowY: isMonthView ? 'auto' : 'visible',
        }}
      >
        {entries.map((entry) => (
          <EntryCard
            key={entry.id}
            entry={entry}
            item={itemById?.[entry.waitingListItemId]}
            isExpanded={isExpanded}
            isMonthView={isMonthView}
            canEdit={canEdit}
            onToggleConfirm={onToggleConfirm}
            onToggleOperated={onToggleOperated}
            onRemoveEntry={onRemoveEntry}
          />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// DAY CELL HEADER SUB-COMPONENT
// ============================================================================

interface DayCellHeaderProps {
  date: string;
  caseCount: number;
  isExpanded: boolean;
  isMonthView: boolean;
  marginBottom: number;
  paddingBottom: number;
  dateFontSize: number;
  caseBadgeFontSize: number;
  onToggleExpand: () => void;
}

function DayCellHeader({
  date,
  caseCount,
  isExpanded,
  isMonthView,
  marginBottom,
  paddingBottom,
  dateFontSize,
  caseBadgeFontSize,
  onToggleExpand,
}: DayCellHeaderProps) {
  const caseLabel = caseCount === 1 ? 'case' : 'cases';

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom,
        paddingBottom,
        borderBottom: isMonthView ? '2px solid var(--border)' : 'none',
      }}
    >
      <strong style={{ fontSize: dateFontSize }}>{date}</strong>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            fontSize: caseBadgeFontSize,
            fontWeight: 500,
            opacity: 0.6,
            background: isMonthView ? 'var(--surface-2)' : 'transparent',
            padding: isMonthView ? '2px 8px' : '0',
            borderRadius: 4,
          }}
        >
          {caseCount} {isMonthView ? caseLabel : `(${caseCount})`}
        </span>
        {isMonthView && (
          <ExpandButton
            isExpanded={isExpanded}
            onToggle={onToggleExpand}
            ariaLabel={`${isExpanded ? 'Collapse' : 'Expand'} ${date}`}
          />
        )}
      </div>
    </div>
  );
}

// ============================================================================
// EXPAND BUTTON SUB-COMPONENT
// ============================================================================

interface ExpandButtonProps {
  isExpanded: boolean;
  onToggle: () => void;
  ariaLabel: string;
}

const ExpandButton = React.memo(function ExpandButton({
  isExpanded,
  onToggle,
  ariaLabel,
}: ExpandButtonProps) {
  return (
    <button
      onClick={onToggle}
      aria-expanded={isExpanded}
      aria-label={ariaLabel}
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
        transition: `opacity ${ANIMATIONS.FAST}, transform ${ANIMATIONS.FAST}`,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.opacity = '1';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.opacity = '0.7';
      }}
    >
      <span
        style={{
          fontSize: 14,
          transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: `transform ${ANIMATIONS.FAST}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        ▼
      </span>
    </button>
  );
});

// ============================================================================
// ENTRY CARD SUB-COMPONENT (Phase 2 Refactoring)
// ============================================================================

interface EntryCardProps {
  entry: ScheduleEntry;
  item?: BacklogItem;
  isExpanded: boolean;
  isMonthView: boolean;
  canEdit: boolean;
  onToggleConfirm?: (id: string, confirmed: boolean) => void | Promise<void>;
  onToggleOperated?: (id: string, operated: boolean) => void | Promise<void>;
  onRemoveEntry?: (id: string) => void | Promise<void>;
}

const EntryCard = React.memo(function EntryCard({
  entry,
  item,
  isExpanded,
  isMonthView,
  canEdit,
  onToggleConfirm,
  onToggleOperated,
  onRemoveEntry,
}: EntryCardProps) {
  const isOperated = (entry.status || 'tentative') === 'operated';
  const isConfirmed = isOperated || (entry.status || 'tentative') === 'confirmed';
  const statusColors = getStatusColors(entry.status);

  const cardBg = isMonthView ? statusColors.bg : 'var(--surface-2)';
  const borderColor = isMonthView ? statusColors.border : 'var(--border)';
  const showCompactLayout = isMonthView && !isExpanded;

  return (
    <div
      style={{
        border: `${isMonthView ? '1.5px' : '1px'} solid ${borderColor}`,
        borderRadius: 6,
        padding: isMonthView
          ? showCompactLayout
            ? MONTH_VIEW.CARD_COMPACT_PADDING
            : MONTH_VIEW.CARD_EXPANDED_PADDING
          : MONTH_VIEW.CARD_COMPACT_PADDING,
        background: cardBg,
        fontSize: isMonthView ? 12 : 13,
        transition: `transform ${ANIMATIONS.SLOW}, box-shadow ${ANIMATIONS.SLOW}, padding ${ANIMATIONS.MEDIUM}`,
      }}
      onMouseEnter={(e) => {
        if (isMonthView) {
          e.currentTarget.style.transform = 'scale(1.02)';
          e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
        }
      }}
      onMouseLeave={(e) => {
        if (isMonthView) {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '0 0 0 transparent';
        }
      }}
    >
      {showCompactLayout ? (
        <CompactEntryCardContent entry={entry} item={item} />
      ) : (
        <ExpandedEntryCardContent
          entry={entry}
          item={item}
          isOperated={isOperated}
          isConfirmed={isConfirmed}
          statusColors={statusColors}
          isMonthView={isMonthView}
          canEdit={canEdit}
          onToggleConfirm={onToggleConfirm}
          onToggleOperated={onToggleOperated}
          onRemoveEntry={onRemoveEntry}
        />
      )}
    </div>
  );
}, (prev, next) => {
  // Memoization: only re-render if these props change
  return (
    prev.entry.id === next.entry.id &&
    prev.isExpanded === next.isExpanded &&
    prev.isMonthView === next.isMonthView
  );
});

// ============================================================================
// COMPACT ENTRY CARD CONTENT
// ============================================================================

interface CompactEntryCardContentProps {
  entry: ScheduleEntry;
  item?: BacklogItem;
}

function CompactEntryCardContent({ entry, item }: CompactEntryCardContentProps) {
  const dur = durationLabel(entry.startTime, entry.endTime);

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: 4,
        }}
      >
        <strong style={{ fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>
          {entry.startTime}
        </strong>
        <span style={{ fontSize: 10, opacity: 0.6, fontStyle: 'italic' }}>{dur}</span>
      </div>
      <div
        style={{
          fontSize: 11,
          fontWeight: 500,
          marginTop: 2,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {item?.patientName ?? 'Patient'}
      </div>
    </div>
  );
}

// ============================================================================
// EXPANDED ENTRY CARD CONTENT
// ============================================================================

interface ExpandedEntryCardContentProps {
  entry: ScheduleEntry;
  item?: BacklogItem;
  isOperated: boolean;
  isConfirmed: boolean;
  statusColors: (typeof STATUS_COLORS)[StatusKey];
  isMonthView: boolean;
  canEdit: boolean;
  onToggleConfirm?: (id: string, confirmed: boolean) => void | Promise<void>;
  onToggleOperated?: (id: string, operated: boolean) => void | Promise<void>;
  onRemoveEntry?: (id: string) => void | Promise<void>;
}

function ExpandedEntryCardContent({
  entry,
  item,
  isOperated,
  isConfirmed,
  statusColors,
  isMonthView,
  canEdit,
  onToggleConfirm,
  onToggleOperated,
  onRemoveEntry,
}: ExpandedEntryCardContentProps) {
  const time = `${entry.startTime}–${entry.endTime}`;
  const dur = durationLabel(entry.startTime, entry.endTime);

  return (
    <div>
      {isMonthView && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: 6,
            gap: 8,
          }}
        >
          <strong style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
            {time}
          </strong>
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              padding: '2px 6px',
              borderRadius: 3,
              background: statusColors.badge,
              color: 'white',
              textTransform: 'capitalize',
              whiteSpace: 'nowrap',
            }}
          >
            {entry.status || 'tentative'}
          </span>
        </div>
      )}
      {!isMonthView && (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <strong style={{ fontSize: 12 }}>{time}</strong>
          <span style={{ opacity: 0.6 }}>{dur}</span>
        </div>
      )}
      <div style={{ marginTop: isMonthView ? 4 : 2 }}>
        <div
          style={{
            fontWeight: isMonthView ? 700 : 600,
            fontSize: isMonthView ? 13 : 12,
          }}
        >
          {item?.patientName ?? 'Patient'}
        </div>
        <div
          style={{
            opacity: isMonthView ? 0.85 : 0.8,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            fontSize: isMonthView ? 11 : 12,
            marginBottom: isMonthView ? 4 : 0,
          }}
        >
          {item?.procedure ?? 'Scheduled case'}
        </div>
        <div
          style={{
            fontSize: isMonthView ? 11 : 12,
            opacity: isMonthView ? 0.75 : 0.7,
          }}
        >
          <strong>OR {entry.roomId}</strong>
          {' · '}
          Surgeon: {entry.surgeonId}
        </div>
      </div>
      {canEdit && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginTop: isMonthView ? 8 : 6,
            flexWrap: 'wrap',
            width: '100%',
            ...(isMonthView ? { paddingTop: 8, borderTop: '1px solid rgba(0,0,0,0.05)' } : {}),
          }}
        >
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
            }}
          >
            <input
              type="checkbox"
              checked={isConfirmed}
              disabled={isOperated}
              onChange={(e) => onToggleConfirm?.(entry.id, e.target.checked)}
              aria-label="Confirmed"
            />
            <span>Confirmed</span>
          </label>
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
            }}
          >
            <input
              type="checkbox"
              checked={isOperated}
              disabled={!isConfirmed && !isOperated}
              onChange={(e) => onToggleOperated?.(entry.id, e.target.checked)}
              aria-label="Operated"
            />
            <span>Operated</span>
          </label>
          {onRemoveEntry && (
            <button
              onClick={() => onRemoveEntry(entry.id)}
              style={{ fontSize: 11, marginLeft: 'auto', padding: '4px 8px' }}
              aria-label={`Remove ${item?.patientName || 'entry'}`}
            >
              Remove
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function parseDragData(dt: DataTransfer): DropData | undefined {
  try {
    const json =
      dt.getData('application/json') ||
      dt.getData('text/plain') ||
      dt.getData('text');
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
    const diffToMon = (day + 6) % 7; // days since Monday
    d.setDate(d.getDate() - diffToMon);
    for (let i = 0; i < 7; i++) {
      const cur = new Date(d);
      cur.setDate(d.getDate() + i);
      result.push(fmt(cur));
    }
  } else {
    // month grid (start from 1st, back to Monday, produce 5-6 weeks)
    const first = new Date(date.getFullYear(), date.getMonth(), 1);
    const startDay = (first.getDay() + 6) % 7; // Monday=0
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
