# Research: OR Waiting List & Scheduling

Track decisions, rationale, and alternatives discovered during Phase 0.

## Decisions & Rationale
- Concurrency: Optimistic concurrency for scheduling edits (reduces locking, resolves on save)
- Exports: Standard field set (name with masked MRN, case type, procedure, room, start–end, surgeon)
- Dedup key: Name + MRN for Excel imports
- Accessibility: Local Team Accessibility Standard (colors, contrast, keyboard)

## Open Questions
- Turnaround/buffer policy (minutes by room/type?)
- Role model & permissions (scheduler/surgeon/admin)
- Sources of truth (patients/surgeons/procedures)
- Import limits (max size/rows) and locale defaults
- Keyboard shortcut scheme (bindings, discoverability)
- Performance targets (p95 interactions, max daily volume)

## Alternatives Considered
- Pessimistic locking: higher friction; rejected for MVP
- Export variants (Minimal/Detailed/Admin): can be post-MVP options
- Dedup via external request ID only: not guaranteed in all inputs
