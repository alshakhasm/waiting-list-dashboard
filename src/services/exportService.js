import { db } from '../lib/store';
import { maskMRN } from '../lib/mrn';
export const ExportService = {
    week() {
        // Simplified: dump waiting list with masked MRN; scheduling details would be joined in a real impl
        return Array.from(db.waiting.values()).map((w) => ({
            name: w.patientName,
            maskedMrn: maskMRN(w.mrn),
            caseTypeId: w.caseTypeId,
            procedure: w.procedure,
        }));
    }
};
