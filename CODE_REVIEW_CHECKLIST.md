# Code Review Checklist - CompactCalendar.tsx Refactoring

## 🔍 Pre-Merge Review Items

### 1. Code Organization & Structure

- [x] Constants properly extracted (MONTH_VIEW, WEEK_VIEW, STATUS_COLORS, ANIMATIONS)
- [x] Helper functions isolated and unchanged
- [x] Components properly decomposed (DayCell, EntryCard, ExpandButton)
- [x] PropTypes/interfaces well-defined for all components
- [ ] **PENDING**: Consider splitting into separate files
  - `CompactCalendar/index.tsx` (main component)
  - `CompactCalendar/DayCell.tsx` (day cell logic)
  - `CompactCalendar/EntryCard.tsx` (entry card logic)
  - `CompactCalendar/constants.ts` (style constants)

---

### 2. TypeScript & Type Safety

- [x] All components have proper TypeScript types
- [x] Props interfaces defined for sub-components
- [x] `StatusKey` type properly constrained
- [x] Return types specified for functions
- [ ] **CHECK**: Run `tsc --noEmit` for strict mode
- [ ] **CHECK**: Run ESLint for style violations

---

### 3. Performance & Optimization

- [x] EntryCard component memoized with custom equality
- [x] ExpandButton component memoized
- [x] buildDays calculated with useMemo
- [x] anchorDate calculated with useMemo
- [ ] **TODO**: Profile with React DevTools
  - Check for unnecessary re-renders
  - Verify memoization effectiveness
  
- [ ] **TODO**: Consider useCallback for handlers
  ```tsx
  const handleDrop = useCallback((e, day) => {...}, [entries, onDrop]);
  const toggleDayExpand = useCallback((date) => {...}, []);
  ```

---

### 4. Accessibility (WCAG 2.1 AA)

- [x] Semantic HTML used (button elements, not divs)
- [x] `aria-expanded` on expand/collapse button
- [x] `aria-label` on buttons and checkboxes
- [x] Status colors meet contrast ratio (WCAG AA)
- [x] `aria-hidden` on placeholder cells
- [ ] **TODO**: Test with screen reader (NVDA, JAWS)
- [ ] **TODO**: Run accessibility audit (WAVE, Axe DevTools)
- [ ] **TODO**: Keyboard navigation (Enter/Space to toggle)
- [ ] **TODO**: Focus visible styling
- [ ] **TODO**: Tab order verification

---

### 5. Testing Coverage

#### Helper Functions (Priority 🔴)
```typescript
// Need tests for:
- [ ] parseDragData() - parse JSON, text/plain, text
- [ ] addMinutes() - time arithmetic (edge cases: wrap around midnight)
- [ ] durationLabel() - format duration as "Xm"
- [ ] buildDays() - generate day arrays for day/week/month views
- [ ] fmt() - format Date to YYYY-MM-DD
- [ ] getStatusColors() - status lookup logic
```

#### Component Tests (Priority 🟡)
```typescript
// Need tests for:
- [ ] CompactCalendar
  - Renders correctly in day/week/month modes
  - Expand/collapse functionality
  - Drag-drop event handling
  - Props validation

- [ ] DayCell
  - Renders with correct styling
  - Memoization working (no unnecessary re-renders)
  - onDrop called correctly
  - onToggleDayExpand called correctly

- [ ] EntryCard
  - Compact layout in collapsed month
  - Expanded layout in expanded month
  - Memoization equality check working
  - Status colors applied correctly

- [ ] ExpandButton
  - Chevron rotates on isExpanded
  - Accessibility attributes present
  - Hover effects work
```

#### Integration Tests (Priority 🟡)
```typescript
- [ ] Month view day expansion
- [ ] Week view rendering
- [ ] Day view rendering
- [ ] Drag-drop to empty day
- [ ] Drag-drop to occupied day (sequential placement)
- [ ] Status toggle (Confirmed → Operated)
- [ ] Remove entry functionality
```

---

### 6. Browser Compatibility

- [ ] Test in Chrome/Edge (latest)
- [ ] Test in Firefox (latest)
- [ ] Test in Safari (latest)
- [ ] Test on mobile browsers
- [ ] Verify animations smooth on all browsers

---

### 7. Visual/UX Testing

- [ ] Month view compact layout (3 lines max)
- [ ] Month view expanded layout (300+ px height)
- [ ] Week view (small cards)
- [ ] Day view (single column)
- [ ] Chevron rotation smooth
- [ ] Card hover effects visible
- [ ] Status colors distinguishable
- [ ] Responsive layout on different screen sizes

---

### 8. Error Handling & Edge Cases

- [x] Out-of-month cells handled correctly
- [ ] **CHECK**: Empty entry list handling
- [ ] **CHECK**: Null/undefined item handling
- [ ] **CHECK**: Invalid time formats
- [ ] **CHECK**: Drag-drop with no duration
- [ ] **CHECK**: Multiple expansions at once (month view)

---

### 9. Documentation & Comments

- [x] Constants documented with JSDoc comments
- [x] Components documented with interface comments
- [x] Helper functions have clear names
- [ ] **TODO**: Add usage examples in comments
- [ ] **TODO**: Add component README
  ```markdown
  # CompactCalendar Component
  
  ## Props
  - date: string (YYYY-MM-DD)
  - view?: 'day' | 'week' | 'month'
  - entries: ScheduleEntry[]
  - ... (other props)
  
  ## Usage Examples
  - Month view with expansion
  - Week view
  - Day view
  ```

---

### 10. Git & Deployment

- [ ] Commit message clear and descriptive
- [ ] Branch pushed to GitHub (dev-fc09d97c)
- [ ] All files formatted correctly
- [ ] No console.log or debug code
- [ ] Build passes: `npm run build` ✅
- [ ] Dev server works: `npm run dev` ✅
- [ ] GitHub Pages build succeeds
- [ ] No merge conflicts

---

## 🚨 Critical Issues to Fix

### GitHub Actions Warnings
Currently showing in `.github/workflows/pages.yml`:
```yaml
❌ VITE_BACKLOG_TAB_LABEL context might be invalid
❌ VITE_APP_TITLE context might be invalid
```

**Fix**: Update GitHub Actions to use correct syntax:
```yaml
env:
  VITE_BACKLOG_TAB_LABEL: ${{ secrets.VITE_BACKLOG_TAB_LABEL || 'Backlog' }}
  VITE_APP_TITLE: ${{ secrets.VITE_APP_TITLE || 'Surgery Schedule' }}
```

---

## 🟡 Medium Priority Improvements

### Component File Organization
```
apps/ui/src/ui/CompactCalendar/
├── index.tsx              (main component ~150 lines)
├── DayCell.tsx            (day cell logic ~100 lines)
├── EntryCard.tsx          (entry card logic ~100 lines)
├── constants.ts           (style constants ~80 lines)
├── types.ts               (TypeScript interfaces)
└── utils.ts               (helper functions ~40 lines)
```

### Extract Styles to CSS-in-JS
Consider using Emotion or styled-components:
```tsx
const DayCellStyled = styled.div`
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: ${MONTH_VIEW.PADDING}px;
  ...
`;
```

---

## 🟢 Nice-to-Have Enhancements

- [ ] Animation tweening options
- [ ] Dark mode support
- [ ] Localization support
- [ ] Custom date formatting
- [ ] Drag-drop preview styling
- [ ] Undo/redo support
- [ ] Keyboard shortcuts documentation

---

## ✅ Sign-Off Checklist

Before merging to main:

- [ ] All console errors/warnings cleared
- [ ] TypeScript compilation passes
- [ ] ESLint passes without warnings
- [ ] Unit tests pass (>80% coverage)
- [ ] Manual testing on all browsers
- [ ] Accessibility audit passed (WAVE)
- [ ] Performance profile reviewed
- [ ] Code review approved (2+ reviewers)
- [ ] Documentation updated
- [ ] Git history clean

---

## 📊 Current Status Summary

| Category | Status | Notes |
|----------|--------|-------|
| Code Quality | 🟡 75% | Phase 1-2 done, Phase 3-4 pending |
| Performance | ✅ 90% | Memoization in place |
| Accessibility | 🟡 60% | Basic ARIA, need keyboard nav |
| Testing | ⭕ 0% | No tests yet |
| Documentation | 🟡 70% | Code commented, need examples |
| **Overall** | 🟡 **59%** | Ready for Phase 3-4 work |

---

## 🎯 Recommended Action Items (in order)

1. **Run TypeScript check**: `tsc --noEmit`
2. **Run ESLint**: `eslint apps/ui/src/ui/CompactCalendar.tsx`
3. **Add Phase 3 keyboard navigation** (30 mins)
4. **Write Phase 4 unit tests** (2-3 hours)
5. **Accessibility audit with WAVE** (1 hour)
6. **Code review meeting** (30 mins)
7. **Split components to separate files** (optional, ~1 hour)
8. **Merge to main** with all above completed

---

## 📞 Questions for Code Review

1. Should we split components into separate files now or later?
2. Any performance concerns with the current memoization strategy?
3. Should keyboard navigation be required for Phase 3?
4. What's the minimum test coverage target? (75%? 80%?)
5. Any styling/design changes needed before merge?

