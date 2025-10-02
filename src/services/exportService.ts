import { db } from '../lib/store';
import type { WaitingListItem } from '../models/types';
import { maskMRN } from '../lib/mrn';

export const ExportService = {
  week(_date: string): Array<{ name: string; maskedMrn: string; caseTypeId: string; procedure: string; room?: string; start?: string; end?: string; surgeon?: string }> {
    // Simplified: dump waiting list with masked MRN; scheduling details would be joined in a real impl
    return Array.from(db.waiting.values()).map((w: WaitingListItem) => ({
      name: w.patientName,
      maskedMrn: maskMRN(w.mrn),
      caseTypeId: w.caseTypeId,
      procedure: w.procedure,
    }));
  }
};
