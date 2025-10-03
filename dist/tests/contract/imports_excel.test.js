import { describe, it, expect, beforeEach } from '@jest/globals';
import { resetDb } from '../../src/lib/store';
import { postImportsExcel } from '../../src/api/imports';
import { listBacklog } from '../../src/api/backlog';
describe('POST /imports/excel', () => {
    beforeEach(() => resetDb());
    it('should accept Excel import and return batch id', async () => {
        const rows = [
            { patientName: 'Alice', mrn: '123456', procedure: 'Appendectomy', estDurationMin: 60, caseTypeName: 'case:elective' },
            { patientName: 'Alice', mrn: '123456', procedure: 'Appendectomy', estDurationMin: 60, caseTypeName: 'case:elective' }, // dup
            { patientName: 'Bob', mrn: '999888', procedure: 'Cholecystectomy', estDurationMin: 90, caseTypeName: 'case:elective' },
            { patientName: '', mrn: '0000' }, // skipped missing name
        ];
        const batch = postImportsExcel('sample.xlsx', rows);
        expect(batch.id).toBeTruthy();
        expect(batch.countsCreated).toBe(2);
        expect(batch.countsSkipped).toBe(2); // 1 dup + 1 missing required
        const backlog = listBacklog();
        expect(backlog.length).toBe(2);
    });
});
