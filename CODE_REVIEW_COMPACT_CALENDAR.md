# Code Review: CompactCalendar.tsx

**Date**: October 26, 2025  
**File**: `apps/ui/src/ui/CompactCalendar.tsx`  
**Status**: ✅ Functional, Ready for Refactoring

---

## Summary

The collapsible month calendar is **working well** but has opportunities for **refactoring** to improve maintainability, performance, and code clarity.

---

## Issues & Improvements

### 🔴 **HIGH PRIORITY**

#### 1. **Magic Numbers & Hard-coded Values**
**Current:**
```tsx
const minHeightMonth = isExpanded ? 320 : 120;
padding: view === 'month' ? 12 : 8,
minHeight: view === 'month' ? minHeightMonth : 120,
```

**Issue**: Heights (120, 320), padding (8, 12), gaps (8, 6) are scattered throughout.

**Suggestion**:
```tsx
// At top of component
const MONTH_STYLES = {
  COMPACT_HEIGHT: 120,
  EXPANDED_HEIGHT: 320,
  PADDING: 12,
  CASE_COUNT_BADGE_SIZE: 13,
  CARD_COMPACT_PADDING: '6px 8px',
  CARD_EXPANDED_PADDING: 10,
} as const;

const WEEK_STYLES = {
  HEIGHT: 120,
  PADDING: 8,
  GAP: 6,
} as const;

const DAY_STYLES = {
  HEIGHT: 120,
  PADDING: 8,
} as const;

// Usage
minHeight: view === 'month' ? minHeightMonth : WEEK_STYLES.HEIGHT,
padding: view === 'month' ? MONTH_STYLES.PADDING : WEEK_STYLES.PADDING,
```

**Benefits**: 
- ✅ Single source of truth
- ✅ Easy to adjust spacing globally
- ✅ Better readability

---

#### 2. **Excessive Inline Styles → Create CSS-in-JS Objects**
**Current**: 40+ inline style definitions scattered across JSX

**Suggestion**:
```tsx
const dayHeaderStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: view === 'month' ? 10 : 6,
  paddingBottom: view === 'month' ? 10 : 0,
  borderBottom: view === 'month' ? '2px solid var(--border)' : 'none',
} as const;

const dayDateStyle = {
  fontSize: view === 'month' ? 16 : 14,
  fontWeight: 'bold',
};

// Usage
<div style={dayHeaderStyle}>
  <strong style={dayDateStyle}>{d}</strong>
  {/* ... */}
</div>
```

**Benefits**:
- ✅ Reusable style objects
- ✅ Cleaner JSX
- ✅ Easier to maintain

---

#### 3. **Color Scheme Hard-coded**
**Current**:
```tsx
const cardBg = view === 'month'
  ? (isOperated ? '#DCFCE7' : isConfirmed ? '#E6F4EA' : '#FEF3C7')
  : 'var(--surface-2)';
```

**Suggestion**:
```tsx
const STATUS_COLORS = {
  operated: { bg: '#DCFCE7', border: '#16a34a', badge: '#047857' },
  confirmed: { bg: '#E6F4EA', border: '#84cc16', badge: '#65a30d' },
  tentative: { bg: '#FEF3C7', border: '#F59E0B', badge: '#b45309' },
} as const;

const getStatusStyle = (status: string) => {
  if (status === 'operated') return STATUS_COLORS.operated;
  if (status === 'confirmed') return STATUS_COLORS.confirmed;
  return STATUS_COLORS.tentative;
};

// Usage
const statusStyle = view === 'month' ? getStatusStyle(en.status || 'tentative') : null;
const cardBg = statusStyle?.bg || 'var(--surface-2)';
```

**Benefits**:
- ✅ Centralized color management
- ✅ Easy to implement dark mode
- ✅ Single point for brand color changes

---

### 🟡 **MEDIUM PRIORITY**

#### 4. **Repeated View-Conditional Logic**
**Current**: `view === 'month'` appears 30+ times

**Suggestion**:
```tsx
const isMonthView = view === 'month';
const isWeekView = view === 'week';
const isDayView = view === 'day';

// Usage
if (isMonthView && !isCurrentMonth) { ... }
```

**Benefits**:
- ✅ Fewer repeated conditions
- ✅ More readable

---

#### 5. **Extract Entry Card to Sub-component**
**Current**: 150+ lines of entry card logic in one inline render

**Suggestion**:
```tsx
interface EntryCardProps {
  entry: ScheduleEntry;
  item?: BacklogItem;
  view: ViewMode;
  isExpanded: boolean;
  canEdit: boolean;
  onToggleConfirm?: (id: string, confirmed: boolean) => void;
  onToggleOperated?: (id: string, operated: boolean) => void;
  onRemoveEntry?: (id: string) => void;
}

function EntryCard({ entry, item, view, isExpanded, canEdit, ...callbacks }: EntryCardProps) {
  // All entry card logic here
  // Much cleaner!
}

// Usage in main component
{list.map((en) => (
  <EntryCard
    key={en.id}
    entry={en}
    item={itemById?.[en.waitingListItemId]}
    view={view}
    isExpanded={isExpanded}
    canEdit={canEdit}
    {...callbacks}
  />
))}
```

**Benefits**:
- ✅ Smaller main component
- ✅ Reusable entry card
- ✅ Easier to test
- ✅ Better separation of concerns

---

#### 6. **Extract Day Cell to Sub-component**
**Current**: 200+ lines for day cell rendering

**Suggestion**:
```tsx
interface DayCellProps {
  date: string;
  entries: ScheduleEntry[];
  isCurrentMonth: boolean;
  isExpanded: boolean;
  view: ViewMode;
  onDrop: (info: CompactCalendarDrop) => void;
  onToggleDayExpand: (date: string) => void;
  itemById?: Record<string, BacklogItem>;
  canEdit?: boolean;
  // ... callback props
}

function DayCell({ date, entries, isExpanded, ...props }: DayCellProps) {
  // All day cell logic here
}
```

**Benefits**:
- ✅ Main component becomes very clean
- ✅ Day cell logic isolated
- ✅ Easier to debug

---

#### 7. **Memoize Entry Card Rendering**
**Current**: All entries re-render on any state change

**Suggestion**:
```tsx
const EntryCard = React.memo(function EntryCard({ entry, item, ...props }: EntryCardProps) {
  return (/* entry card JSX */);
}, (prev, next) => {
  // Custom equality check - only re-render if entry or isExpanded changed
  return prev.entry.id === next.entry.id && prev.isExpanded === next.isExpanded;
});
```

**Benefits**:
- ✅ Prevent unnecessary re-renders
- ✅ Better performance with many entries

---

### 🟢 **LOW PRIORITY**

#### 8. **Keyboard Navigation**
**Current**: Only mouse/click interactions

**Suggestion**:
```tsx
const handleKeyDown = (e: React.KeyboardEvent, date: string) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    toggleDayExpand(date);
  }
};

// On expand button
onKeyDown={(e) => handleKeyDown(e, d)}
```

**Benefits**:
- ✅ Better accessibility
- ✅ WCAG compliance

---

#### 9. **Accessibility: aria-attributes**
**Current**: Minimal aria labels

**Suggestion**:
```tsx
<button
  onClick={() => toggleDayExpand(d)}
  aria-expanded={isExpanded}
  aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${d}`}
  aria-controls={`day-entries-${d}`}
  // ...
>
  ▼
</button>

<div id={`day-entries-${d}`}>
  {/* entries */}
</div>
```

**Benefits**:
- ✅ Screen reader friendly
- ✅ Better semantics

---

#### 10. **Performance: Memoize buildDays**
**Current**: `buildDays` called with useMemo

**Suggestion**: Make it fully memoized at module level
```tsx
const buildDaysCache = new Map<string, string[]>();

function buildDays(anchor: string, view: ViewMode): string[] {
  const key = `${anchor}-${view}`;
  if (buildDaysCache.has(key)) {
    return buildDaysCache.get(key)!;
  }
  
  const days = /* ... calculation ... */;
  buildDaysCache.set(key, days);
  return days;
}
```

**Benefits**:
- ✅ Persistent cache across renders
- ✅ Better performance

---

## Refactoring Roadmap

### Phase 1 (Quick Wins - 2-3 hours)
1. Extract style constants (MONTH_STYLES, WEEK_STYLES, STATUS_COLORS)
2. Create view-conditional flags (isMonthView, etc.)
3. Create style objects (dayHeaderStyle, cardStyle, etc.)

### Phase 2 (Component Extraction - 4-5 hours)
1. Extract EntryCard sub-component
2. Extract DayCell sub-component
3. Add PropTypes/JSDoc

### Phase 3 (Polish - 2-3 hours)
1. Add keyboard navigation
2. Enhance accessibility (aria labels)
3. Add React.memo for performance

### Phase 4 (Testing - 1-2 hours)
1. Unit tests for helper functions
2. Component snapshot tests
3. Accessibility tests

---

## Estimated Impact

| Metric | Current | After Refactor |
|--------|---------|----------------|
| **File size** | 416 lines | ~250 lines (main) + 100 (Entry) + 150 (Day) |
| **Cyclomatic complexity** | High | Medium |
| **Reusability** | Low | High |
| **Testability** | Medium | High |
| **Maintainability** | Medium | High |
| **Performance** | Good | Better (memoization) |

---

## Next Steps

1. **Gather feedback** on refactoring priorities
2. **Create feature branch** for refactoring
3. **Implement Phase 1** changes
4. **Test thoroughly** before merging
5. **Document** new component APIs

---

## Questions?

- Should we prioritize component extraction or performance optimization first?
- Any specific styling concerns or preferences?
- Want to add TypeScript strict mode?

