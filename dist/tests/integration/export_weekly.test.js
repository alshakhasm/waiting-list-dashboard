import { describe, it, expect, beforeEach } from '@jest/globals';
import { resetDb } from '../../src/lib/store';
import { postImportsExcel } from '../../src/api/imports';
import { getWeeklyExport } from '../../src/api/exports';
describe('Weekly export', () => {
    beforeEach(() => resetDb());
    it('should contain standard fields with masked MRN', async () => {
        postImportsExcel('seed.xlsx', [
            { patientName: 'K', mrn: '44443333', procedure: 'Proc', estDurationMin: 30 },
        ]);
        const rows = getWeeklyExport('2025-01-01');
        expect(rows.length).toBe(1);
        expect(rows[0]).toMatchObject({ name: 'K', procedure: 'Proc' });
        expect(rows[0].maskedMrn).toBe('••••3333');
    });
});
