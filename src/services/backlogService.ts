import { db } from '../lib/store';
import { maskMRN } from '../lib/mrn';
import type { WaitingListItem } from '../models/types';

export const BacklogService = {
  list(params?: { caseTypeId?: string; surgeonId?: string; search?: string }): Array<WaitingListItem & { maskedMrn: string }> {
    let items = Array.from(db.waiting.values());
    if (params?.caseTypeId) items = items.filter(i => i.caseTypeId === params.caseTypeId);
    if (params?.surgeonId) items = items.filter(i => i.surgeonId === params.surgeonId);
    if (params?.search) items = items.filter(i => (i.patientName + ' ' + i.procedure).toLowerCase().includes(params.search!.toLowerCase()));
    return items.map(i => ({ ...i, maskedMrn: maskMRN(i.mrn) }));
  }
};
