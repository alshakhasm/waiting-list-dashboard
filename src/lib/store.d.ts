import type { WaitingListItem, ScheduleEntry, MappingProfile, ImportBatch, CaseType } from '../models/types';
export declare const db: {
    waiting: Map<string, WaitingListItem>;
    schedule: Map<string, ScheduleEntry>;
    mappings: Map<string, MappingProfile>;
    imports: Map<string, ImportBatch>;
    caseTypes: Map<string, CaseType>;
};
export declare function resetDb(): void;
