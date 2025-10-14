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
  },
  softRemove(id: string): boolean {
    if (!db.waiting.has(id)) return false;
    db.waiting.delete(id);
    return true;
  },
  update(id: string, patch: Partial<Pick<WaitingListItem,
    'patientName' | 'mrn' | 'procedure' | 'estDurationMin' | 'surgeonId' | 'caseTypeId' |
    'phone1' | 'phone2' | 'preferredDate' | 'notes'>>): (WaitingListItem & { maskedMrn: string }) | null {
    const current = db.waiting.get(id);
    if (!current) return null;
    const updated: WaitingListItem = {
      ...current,
      ...patch,
    };
    db.waiting.set(id, updated);
    return { ...updated, maskedMrn: maskMRN(updated.mrn) };
  },
};
