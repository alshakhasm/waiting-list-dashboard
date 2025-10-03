# Data Model: OR Waiting List & Scheduling

## Entities
- WaitingListItem (Case Request)
  - id, patient_name, mrn, case_type, procedure, est_duration_min, surgeon_id, priority, equipment, triage_status, notes, created_at
- CaseType
  - id, name, color_code, description
- ORRoom
  - id, name, location, capabilities
- ScheduleEntry
  - id, waiting_list_item_id, room_id, surgeon_id, date, start_time, end_time, status, notes, updated_at, version
- Surgeon
  - id, name, specialty, availability
- ImportBatch
  - id, file_name, imported_at, mapping_profile_id, counts_created, counts_updated, counts_skipped, errors
- MappingProfile
  - id, name, owner, field_mappings, required_fields_policy
- ExportArtifact
  - id, date_range, included_fields, generated_at, format

## Relationships
- WaitingListItem 1—1 ScheduleEntry (at most one active scheduled entry)
- CaseType 1—* WaitingListItem
- ORRoom 1—* ScheduleEntry
- Surgeon 1—* WaitingListItem and 1—* ScheduleEntry

## Constraints
- Dedup key for imports: (patient_name, mrn)
- Kanban category change updates WaitingListItem.case_type and audit log
- Optimistic concurrency on ScheduleEntry via `version` or timestamp
- PHI minimized in list views; Standard fields in exports
