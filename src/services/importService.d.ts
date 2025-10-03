import type { ImportBatch, MappingProfile, WaitingListItem } from '../models/types';
export type ImportRow = Partial<Pick<WaitingListItem, 'patientName' | 'mrn' | 'procedure' | 'estDurationMin' | 'surgeonId'>> & {
    caseTypeName?: string;
};
export declare const ImportService: {
    importExcel(fileName: string, rows: ImportRow[], mapping?: MappingProfile): ImportBatch;
};
