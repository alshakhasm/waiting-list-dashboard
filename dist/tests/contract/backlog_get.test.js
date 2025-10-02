import { describe, it, expect, beforeEach } from '@jest/globals';
import { resetDb } from '../../src/lib/store';
import { postImportsExcel } from '../../src/api/imports';
import { listBacklog } from '../../src/api/backlog';
describe('GET /backlog', () => {
    beforeEach(() => resetDb());
    it('should filter by caseType/surgeon and mask PHI', async () => {
        postImportsExcel('seed.xlsx', [
            { patientName: 'A', mrn: '11112222', procedure: 'Proc1', estDurationMin: 30, caseTypeName: 'case:elective', surgeonId: 's:1' },
            { patientName: 'B', mrn: '33334444', procedure: 'Proc2', estDurationMin: 60, caseTypeName: 'case:urgent', surgeonId: 's:2' },
        ]);
        const all = listBacklog();
        expect(all.map(x => x.maskedMrn)).toEqual(['••••2222', '••••4444']);
        const elect = listBacklog({ caseTypeId: 'case:elective' });
        expect(elect.length).toBe(1);
        expect(elect[0].procedure).toBe('Proc1');
        const s2 = listBacklog({ surgeonId: 's:2' });
        expect(s2.length).toBe(1);
        expect(s2[0].procedure).toBe('Proc2');
    });
});
