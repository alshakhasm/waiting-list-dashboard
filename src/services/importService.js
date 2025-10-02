import { db } from '../lib/store';
import { newId } from '../lib/id';
export const ImportService = {
    importExcel(fileName, rows, mapping) {
        const batchId = newId('imp');
        let created = 0, skipped = 0;
        const updated = 0;
        const errors = [];
        // Simple dedup by (patientName, mrn)
        const seen = new Set();
        for (const r of rows) {
            if (!r.patientName || !r.mrn) {
                skipped++;
                continue;
            }
            const key = `${r.patientName}|${r.mrn}`;
            if (seen.has(key)) {
                skipped++;
                continue;
            }
            seen.add(key);
            // create waiting item
            const id = newId('w');
            const item = {
                id,
                patientName: r.patientName,
                mrn: r.mrn,
                caseTypeId: r.caseTypeName ?? 'case:unknown',
                procedure: r.procedure ?? '',
                estDurationMin: r.estDurationMin ?? 0,
                surgeonId: r.surgeonId,
                createdAt: new Date().toISOString(),
            };
            db.waiting.set(id, item);
            created++;
        }
        const batch = {
            id: batchId,
            fileName,
            importedAt: new Date().toISOString(),
            mappingProfileId: mapping?.id,
            countsCreated: created,
            countsUpdated: updated,
            countsSkipped: skipped,
            errors,
        };
        db.imports.set(batchId, batch);
        return batch;
    }
};
