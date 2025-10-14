import { db } from '../lib/store';
import { maskMRN } from '../lib/mrn';
export const BacklogService = {
    list(params) {
        let items = Array.from(db.waiting.values());
        if (params?.caseTypeId)
            items = items.filter(i => i.caseTypeId === params.caseTypeId);
        if (params?.surgeonId)
            items = items.filter(i => i.surgeonId === params.surgeonId);
        if (params?.search)
            items = items.filter(i => (i.patientName + ' ' + i.procedure).toLowerCase().includes(params.search.toLowerCase()));
        return items.map(i => ({ ...i, maskedMrn: maskMRN(i.mrn) }));
    },
    softRemove(id) {
        if (!db.waiting.has(id))
            return false;
        db.waiting.delete(id);
        return true;
    },
    update(id, patch) {
        const current = db.waiting.get(id);
        if (!current)
            return null;
        const updated = {
            ...current,
            ...patch,
        };
        db.waiting.set(id, updated);
        return { ...updated, maskedMrn: maskMRN(updated.mrn) };
    },
};
