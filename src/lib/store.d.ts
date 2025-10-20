import type { WaitingListItem, ScheduleEntry, ImportBatch, CaseType } from '../models/types';
export declare const db: {
    waiting: Map<string, WaitingListItem>;
    schedule: Map<string, ScheduleEntry>;
    imports: Map<string, ImportBatch>;
    caseTypes: Map<string, CaseType>;
};
export declare function resetDb(): void;
