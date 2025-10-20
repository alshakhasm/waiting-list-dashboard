import type { WaitingListItem, ScheduleEntry, ImportBatch, CaseType } from '../models/types';

export const db = {
  waiting: new Map<string, WaitingListItem>(),
  schedule: new Map<string, ScheduleEntry>(),
  imports: new Map<string, ImportBatch>(),
  caseTypes: new Map<string, CaseType>(),
};

export function resetDb() {
  db.waiting.clear();
  db.schedule.clear();
  db.imports.clear();
  db.caseTypes.clear();
}
