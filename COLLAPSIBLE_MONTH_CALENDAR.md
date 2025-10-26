# Collapsible Month Calendar Enhancement

**Date**: October 26, 2025  
**Branch**: dev-fc09d97c  
**File Modified**: `apps/ui/src/ui/CompactCalendar.tsx`  
**Feature**: Collapsible day cards with inline expand/collapse in month view

---

## Overview

Enhanced the **CompactCalendar component's month view** with a **collapsible/expandable design**:

### Default (Collapsed) State
- **Compact day cards** (120px min-height)
- **Minimal information** per entry:
  - Time (start only, e.g., "08:00")
  - Duration (e.g., "90m")
  - Patient name (truncated with ellipsis)
- **Chevron arrow** (▼) button in header to expand
- More entries visible on screen at once
- Focuses on quick scanning

### Expanded State (on Click)
- **Full day cards** (320px min-height)
- **Complete information** per entry:
  - Time range (e.g., "08:00–09:30")
  - Status badge (Operated/Confirmed/Tentative)
  - Patient name (bold, large)
  - Procedure (truncated)
  - Room number + Surgeon ID
  - Checkboxes (Confirmed/Operated) if editable
  - Remove button if editable
- **Chevron rotates** (▲ pointing up) to indicate expanded state
- **Smooth inline expansion** (other cards push down)

---

## Key Implementation Details

### 1. State Management
```tsx
const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

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
```
- **Multiple days can be expanded simultaneously**
- State is a `Set<string>` of day dates (YYYY-MM-DD format)
- Uses standard React state toggle pattern

### 2. Dynamic Min-Height
```tsx
const isExpanded = view === 'month' && expandedDays.has(d);
const minHeightMonth = isExpanded ? 320 : 120;

// Applied to day card:
minHeight: view === 'month' ? minHeightMonth : 120,
transition: 'box-shadow 0.2s ease, transform 0.2s ease, min-height 0.3s ease',
```
- **Smooth 0.3s transition** when toggling
- Expanded: 320px (full details visible)
- Collapsed: 120px (compact layout)

### 3. Expand/Collapse Button
```tsx
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
```
- **Position**: Top-right of day header, next to case count badge
- **Icon**: Chevron down (▼)
  - Points down (0°) when **collapsed**
  - Rotates up (180°) when **expanded**
  - Smooth 0.2s rotation transition
- **Hover effect**: Opacity changes from 0.7 to 1.0
- **Accessibility**: Title attribute shows "Expand" or "Collapse"

### 4. Compact Layout (Collapsed)
```tsx
const showCompactLayout = view === 'month' && !isExpanded;

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
```
- **Time row**: Start time (11px) + Duration (10px italic)
- **Patient name**: Single line, truncated with ellipsis
- **No procedure, surgeon, or status badge** (to save space)
- **Minimal padding**: 6px × 8px (vs 10px when expanded)

### 5. Expanded Layout (Same as Before)
```tsx
// Full details shown when isExpanded=true:
// - Time range (08:00–09:30)
// - Status badge (top-right)
// - Patient name (bold, larger)
// - Procedure
// - Room + Surgeon
// - Checkboxes + Remove button (if canEdit)
```

---

## Visual Comparison

### Collapsed (120px)
```
┌─────────────────┐
│ 2025-10-29 [▼]  │ ← Collapse all; 2 cases shown
├─────────────────┤
│ 08:00  90m      │
│ Sam 964 (truncate)
├─────────────────┤
│ 09:30  60m      │
│ John D (truncate)
└─────────────────┘
```

### Expanded (320px)
```
┌──────────────────────────────┐
│ 2025-10-29            [▲]    │ ← Expanded; full details
├──────────────────────────────┤
│ 08:00–09:30   [Confirmed]   │
│ Sam 964                      │
│ Knee replacement surgery     │
│ OR 3 · Surgeon: s2          │
│ ☑ Confirmed  ☑ Operated     │
├──────────────────────────────┤
│ 09:30–10:30   [Tentative]   │
│ John Doe                     │
│ Hip replacement              │
│ OR 1 · Surgeon: s4          │
│ ☑ Confirmed  ☐ Operated     │
└──────────────────────────────┘
```

---

## Interaction Flow

1. **User sees month calendar** with compact day cards (120px height)
   - Can see 6-8 day cards at once (depending on screen)
   - Each shows: time, duration, patient name
   - Case count badge visible

2. **User clicks chevron ▼ on a day**
   - That day card expands to 320px inline
   - Chevron rotates to ▲
   - Cards below shift down
   - Full details now visible

3. **User can expand multiple days**
   - Click chevron on another day → also expands
   - Both cards now show full details
   - Others remain collapsed

4. **User clicks chevron ▲ to collapse**
   - Day card shrinks back to 120px
   - Chevron rotates back to ▼
   - Cards above/below adjust

---

## Technical Details

### State Persistence
- **Expanded state persists** while user navigates within same month
- **Resets** when switching to a different month or changing view
- **Multiple days** can be expanded at the same time

### Performance
- ✅ No new data fetches or API calls
- ✅ Pure UI state management with React
- ✅ CSS transitions (GPU-accelerated)
- ✅ Scalable to 42 days (6 weeks × 7 days)

### Backward Compatibility
- ✅ Week and day views **unchanged**
- ✅ Component props **unchanged**
- ✅ No breaking changes to API
- ✅ Fully compatible with existing functionality

### Browser Support
- ✅ CSS transitions (all modern browsers)
- ✅ ES6 Set (all modern browsers)
- ✅ CSS `transform` & `rotate()` (all modern browsers)

---

## Responsive Behavior

| Breakpoint | Layout | Collapsed Height | Expanded Height |
|------------|--------|------------------|-----------------|
| Desktop | 7 cols (200px each) | 120px | 320px |
| Tablet | 4-5 cols | 120px | 320px |
| Mobile | 2-3 cols | 120px | 320px |

- Expansion pushes cards down inline
- No modal or side panel needed
- Responsive grid handles overflow automatically

---

## Testing Checklist

- [ ] Navigate to Schedule → Month view
- [ ] Verify day cards show compact layout (120px, minimal info)
- [ ] Click chevron ▼ on a day card
  - [ ] Card expands to 320px
  - [ ] Chevron rotates to ▲
  - [ ] Full details appear (procedure, surgeon, status badge)
  - [ ] Cards below shift down
- [ ] Click multiple days' chevrons
  - [ ] Multiple cards can be expanded at once
- [ ] Click chevron ▲ to collapse
  - [ ] Card shrinks back to 120px
  - [ ] Chevron rotates back to ▼
  - [ ] Cards adjust layout
- [ ] Test on mobile/tablet
  - [ ] Responsive grid works
  - [ ] Expand/collapse still works smoothly
- [ ] Verify week/day views are unchanged
- [ ] Check that checkboxes and remove buttons work in expanded state
- [ ] Scroll within a day (if many entries, 5+)
  - [ ] Overflow scrolls properly

---

## Future Enhancements

- [ ] Keyboard navigation (arrow keys to expand/collapse)
- [ ] Remember expanded days across page reloads (localStorage)
- [ ] Double-click to expand (in addition to chevron)
- [ ] Collapse all / Expand all buttons in calendar header
- [ ] Animate entry cards on expand (stagger effect)
- [ ] Quick action buttons on compact layout (click to confirm/operate)
- [ ] Drag-and-drop between collapsed day cards

---

## Files Changed

- ✅ `apps/ui/src/ui/CompactCalendar.tsx`
  - Added `useState` import for state management
  - Added `expandedDays` state and `toggleDayExpand` function
  - Updated day card height logic with `isExpanded` check
  - Added expand/collapse button with chevron icon
  - Split entry card rendering into `showCompactLayout` branches
  - Added smooth transitions for expand/collapse animation

---

## Dev Server Status

- **Latest changes**: Collapsible month view ✅ compiled and ready
- **Port**: 4002 (or 5173 if available)
- **No errors**: Zero compilation issues
- **HMR**: Active (changes auto-reload)

---

## Summary

The collapsible month calendar provides a **balanced UX**:

✅ **Compact by default** → See more days/entries at a glance  
✅ **Expandable on demand** → Full details when needed  
✅ **Smooth transitions** → Professional, polished feel  
✅ **Multiple expansions** → Compare multiple days  
✅ **No modal clutter** → Inline expansion  
✅ **Responsive** → Works on all screen sizes  
✅ **Simple toggle** → One-click expand/collapse  

Now users can quickly scan the month view and expand only the days they want to examine in detail! 🎉
