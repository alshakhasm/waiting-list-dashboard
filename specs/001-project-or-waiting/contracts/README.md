# Contracts: OR Waiting List & Scheduling

Define service contracts (request/response) for key interactions.

## Endpoints (to be detailed in Phase 1)
- POST /imports/excel (multipart) — mapping wizard submit
- GET /mapping-profiles — list saved mappings
- GET /backlog — list waiting list items (filters: case type, surgeon, search)
- POST /schedule — create schedule entry (validations)
- PATCH /schedule/{id} — update schedule entry (optimistic concurrency)
- DELETE /schedule/{id} — cancel
- GET /exports/schedule?range=day|week&date=YYYY-MM-DD&format=pdf|xlsx — export
- GET /legend — color legend

Each endpoint needs request/response shapes and error codes; contract tests will assert schemas.
