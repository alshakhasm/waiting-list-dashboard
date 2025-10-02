import { db } from '../lib/store';
import { newId } from '../lib/id';
import type { ImportBatch, MappingProfile, WaitingListItem } from '../models/types';

export type ImportRow = Partial<Pick<WaitingListItem, 'patientName' | 'mrn' | 'procedure' | 'estDurationMin' | 'surgeonId'>> & { caseTypeName?: string };

export const ImportService = {
  importExcel(fileName: string, rows: ImportRow[], mapping?: MappingProfile): ImportBatch {
    const batchId = newId('imp');
  let created = 0, skipped = 0;
  const updated = 0;
    const errors: string[] = [];

    // Simple dedup by (patientName, mrn)
    const seen = new Set<string>();

    for (const r of rows) {
      if (!r.patientName || !r.mrn) { skipped++; continue; }
      const key = `${r.patientName}|${r.mrn}`;
      if (seen.has(key)) { skipped++; continue; }
      seen.add(key);

      // create waiting item
      const id = newId('w');
      const item: WaitingListItem = {
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

    const batch: ImportBatch = {
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
