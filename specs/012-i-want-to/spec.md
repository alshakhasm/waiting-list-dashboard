# Feature Specification: Card Roller Tab

**Feature Branch**: `012-i-want-to`  
**Created**: 2025-10-08  
**Status**: Draft  
**Input**: User description: "i want to add a \" card roller \" tab . it work loke one card at atime . with next and previous arrows. each card show full info of patient"

## Clarifications

### Session 2025-10-08
- Q: How should navigation behave at the ends of the list? → A: Stop at ends (disable at first/last)
- Q: Do you want keyboard navigation mapping? → A: Up = Previous, Down = Next
- Q: Should the card include quick actions? → A: Edit, Schedule, Remove
- Q: Which ordering should Card Roller use? → A: Chronological by created date (oldest→newest)
- Q: Should Card Roller respect filters or require category selection? → A: Require selecting a category; show only that category
- Q: What if the selected category has zero items? → A: Show empty state message ("No items in this category")

## Execution Flow (main)
```
1. Parse user description from Input
   → If empty: ERROR "No feature description provided"
2. Extract key concepts from description
   → Identify: actors, actions, data, constraints
3. For each unclear aspect:
   → Mark with [NEEDS CLARIFICATION: specific question]
4. Fill User Scenarios & Testing section
   → If no clear user flow: ERROR "Cannot determine user scenarios"
5. Generate Functional Requirements
   → Each requirement must be testable
   → Mark ambiguous requirements
6. Identify Key Entities (if data involved)
7. Run Review Checklist
   → If any [NEEDS CLARIFICATION]: WARN "Spec has uncertainties"
   → If implementation details found: ERROR "Remove tech details"
8. Return: SUCCESS (spec ready for planning)
```

---

## ⚡ Quick Guidelines
- ✅ Focus on WHAT users need and WHY
- ❌ Avoid HOW to implement (no tech stack, APIs, code structure)
- 👥 Written for business stakeholders, not developers

### Section Requirements
- **Mandatory sections**: Must be completed for every feature
- **Optional sections**: Include only when relevant to the feature
- When a section doesn't apply, remove it entirely (don't leave as "N/A")

### For AI Generation
When creating this spec from a user prompt:
1. **Mark all ambiguities**: Use [NEEDS CLARIFICATION: specific question] for any assumption you'd need to make
2. **Don't guess**: If the prompt doesn't specify something (e.g., "login system" without auth method), mark it
3. **Think like a tester**: Every vague requirement should fail the "testable and unambiguous" checklist item
4. **Common underspecified areas**:
   - User types and permissions
   - Data retention/deletion policies  
   - Performance targets and scale
   - Error handling behaviors
   - Integration requirements
   - Security/compliance needs

---

## User Scenarios & Testing *(mandatory)*

### Primary User Story
As a scheduler or clinician reviewing the backlog, I want a "Card Roller" view that shows one patient card at a time with full details and simple Next/Previous navigation, so I can review patients sequentially without distraction.

### Acceptance Scenarios
1. **Given** there are items in the backlog, **When** I open the Card Roller tab, **Then** I see the first patient’s card with complete details and navigation controls (Previous disabled on first card, Next enabled if more exist).
2. **Given** I am on a card that is not the last, **When** I press Next, **Then** the next patient’s full card appears and the position indicator updates (e.g., "3 of 12").
3. **Given** I am on the last card, **When** I press Next, **Then** Next is disabled and no further navigation occurs (no looping).
4. **Given** I am on any card, **When** I press Previous, **Then** I see the prior patient’s card or the control is disabled on the first card.
5. **Given** I resize the window or switch themes, **When** I view the card, **Then** content remains readable and the layout adapts without overlapping content.
6. **Given** there are zero backlog items, **When** I open the Card Roller tab, **Then** I see an empty state message with guidance.
7. **Given** I’m using the keyboard, **When** I press Up/Down arrows, **Then** it navigates Previous (Up) and Next (Down).
8. **Given** I’m reviewing a card, **When** I click a quick action (Edit, Schedule, or Remove), **Then** the action completes and the navigation position is preserved; if the item is removed, the view advances to the next item (or previous if no next; or shows empty state if list becomes empty).
9. **Given** I open Card Roller without a category selected, **When** the view loads, **Then** I am prompted to select a category; after selection, the first card of that category is shown.
10. **Given** I switch the selected category, **When** I confirm the new category, **Then** the Card Roller resets to the first item of the newly selected category (chronological order), or shows empty state if none.
11. **Given** the selected category has zero items, **When** I view Card Roller, **Then** I see an empty state that reads "No items in this category" with an affordance to change category.

### Edge Cases
- Large text or long notes: the card should scroll internally or expand without breaking layout.
- Missing fields (e.g., no phone2): show clearly as empty/placeholder instead of blank UI.
- Concurrent changes: if the underlying backlog updates, the card should refresh or show a subtle notice [NEEDS CLARIFICATION: live updates vs. static snapshot].
- Access/permissions: users without edit rights should see read-only cards [NEEDS CLARIFICATION: which roles can edit?].
- Filters/search: when a search/filter is applied elsewhere, Card Roller should respect the same item set and order [NEEDS CLARIFICATION: source and ordering rules].

## Requirements *(mandatory)*

### Functional Requirements
- **FR-001**: System MUST provide a new top-level tab or entry named "Card Roller" accessible from the UI navigation.
- **FR-002**: System MUST display exactly one backlog patient card at a time in this view.
- **FR-003**: System MUST include Previous and Next controls to move between cards in sequence.
- **FR-004**: System MUST show the current position indicator (e.g., "1 of N").
- **FR-005**: System MUST render full patient information on the card including: patient name, MRN, procedure, estimated minutes, case type/priority, category, surgeon (if any), phones, preferred date, created date, and notes. If a field is missing, show a clear placeholder (e.g., "—").
- **FR-006**: System MUST handle empty datasets by showing an informative empty state.
- **FR-007**: System MUST stop at the ends: disable Previous on the first card and disable Next on the last card (no looping).
- **FR-008**: System MUST provide keyboard navigation with Up = Previous and Down = Next.
- **FR-009**: System MUST keep the current position stable after performing in-card actions (Edit, Schedule) and, when removing the current item, advance to the next item; if no next exists, move to the previous; if the list becomes empty, show the empty state.
- **FR-013**: System MUST expose quick actions on the card: Edit, Schedule, and Remove (visible only to users with permission).
- **FR-010**: System MUST step through items in chronological created date order (oldest → newest), independent of other views’ sort.
- **FR-011**: System MUST adapt for both light and dark themes with accessible contrast for all text.
- **FR-012**: System MUST ensure that users without permissions see a read-only card state and cannot trigger restricted actions [NEEDS CLARIFICATION: exact permissions].
- **FR-014**: System MUST require selecting a category before showing cards; only items from the selected category are included. Changing the category resets position to the first item of that category.
- **FR-015**: System MUST show an empty state with the copy "No items in this category" when the selected category contains zero items and provide an affordance to change category.

### Key Entities *(include if feature involves data)*
- **Card (Backlog Item View)**: Represents a single backlog item’s full details as shown in the Card Roller; includes field formatting and action affordances.
- **Navigation Context**: The ordered collection of backlog item IDs the Card Roller iterates through, derived from active filters and sort.

---

## Review & Acceptance Checklist
*GATE: Automated checks run during main() execution*

### Content Quality
- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

### Requirement Completeness
- [ ] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous  
- [x] Success criteria are measurable
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

---

## Execution Status
*Updated by main() during processing*

- [x] User description parsed
- [x] Key concepts extracted
- [x] Ambiguities marked
- [x] User scenarios defined
- [x] Requirements generated
- [x] Entities identified
- [ ] Review checklist passed

---
