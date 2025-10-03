# Tasks: UI Aesthetics (Coding Environment-inspired)

Input: spec.md, plan.md, data-model.md, research.md for this feature
Branch: 002-ui-esthetics-like

Assumptions:
- Frontend in `src/ui` with React; token helpers in `src/lib/design`
- Pref storage through a simple service we can stub and swap later

Rules:
- TDD-first: write tests that fail before implementation
- Mark [P] for tasks that can run in parallel (different files)
- Keep tasks atomic; commit after each

## Phase A: Setup
1) UA001 [P] Create design token scaffolding
   - Files: src/lib/design/tokens.ts, tests/unit/ui/tokens.test.ts
2) UA002 [P] Add ThemeProvider and useTheme hook scaffolding
   - Files: src/ui/ThemeProvider.tsx, tests/unit/ui/theme_provider.test.ts

## Phase B: Tests First (Failing)
3) UA003 [P] Unit test: token resolution for Default and High-Contrast
   - File: tests/unit/ui/tokens.test.ts
4) UA004 [P] Unit test: focus-visible styles satisfy contrast in both themes
   - File: tests/unit/ui/focus_visible_a11y.test.ts
5) UA005 [P] Unit test: typography presets scale font size and spacing
   - File: tests/unit/ui/typography_scale.test.ts
6) UA006 [P] Unit test: ThemeProvider persists preference via service
   - File: tests/unit/ui/theme_persistence.test.ts
7) UA007 [P] Integration test: legend colors/labels match cards and calendar
   - File: tests/integration/ui/legend_consistency.test.ts

## Phase C: Implementation
8) UA008 Implement tokens: Default and High-Contrast (semantic colors + typography scales)
   - File: src/lib/design/tokens.ts
9) UA009 Implement ThemeProvider and useTheme with CSS variables application
   - File: src/ui/ThemeProvider.tsx
10) UA010 Implement TypographyPreset mapping and scale helpers
    - File: src/lib/design/typography.ts
11) UA011 Add PreferenceService with get/set stubs (in-memory)
    - File: src/services/preferenceService.ts
12) UA012 Wire ThemeProvider to PreferenceService (load on mount, save on change)
    - Files: src/ui/ThemeProvider.tsx
13) UA013 Add focus-visible style tokens and expose helpers
    - File: src/lib/design/a11y.ts

## Phase D: Validation & Polish
14) UA014 Update legend consumption to rely on tokens
    - Files: src/services/legendService.ts (adapter), src/ui/* as needed
15) UA015 Performance sanity: theme switch and preset change under 50ms render
    - File: tests/performance/ui/theme_switch.perf.test.ts
16) UA016 Update docs: add design tokens and theming guidance
    - Files: specs/002-ui-esthetics-like/plan.md (append), README.md (link)

Dependencies:
- Tests (UA003–UA007) BEFORE implementation (UA008–UA013)
- PreferenceService (UA011) BEFORE wiring (UA012)
- Tokens (UA008) BEFORE ThemeProvider application (UA009) and legend consumption (UA014)

Parallelizable examples:
- UA003–UA007 can be authored in parallel (separate test files)
- UA008, UA010, UA011 can be implemented in parallel (distinct files)

Validation checklist:
- Both themes defined with semantic tokens
- Typography presets scale consistently across components
- Focus-visible meets contrast; non-color indicators respected by consumers
- Preferences persist across sessions; defaults sane when empty
