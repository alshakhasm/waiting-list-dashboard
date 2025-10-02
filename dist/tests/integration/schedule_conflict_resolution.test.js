import { describe, it, expect, beforeEach } from '@jest/globals';
import { resetDb, db } from '../../src/lib/store';
import { postImportsExcel } from '../../src/api/imports';
import { postSchedule, patchSchedule } from '../../src/api/schedule';
describe('Concurrency conflict on update', () => {
    beforeEach(() => resetDb());
    it('should prompt resolution path', async () => {
        postImportsExcel('seed.xlsx', [
            { patientName: 'Q', mrn: '12125555', procedure: 'Proc', estDurationMin: 30, surgeonId: 's:1' },
        ]);
        const w = Array.from(db.waiting.values())[0];
        const e = postSchedule({ waitingListItemId: w.id, roomId: 'or:1', surgeonId: 's:1', date: '2025-01-05', startTime: '08:00', endTime: '09:00' });
        // Two concurrent edits: one succeeds, one uses stale version
        const ok = patchSchedule(e.id, { version: e.version, startTime: '09:00', endTime: '10:00' });
        expect(ok.version).toBe(e.version + 1);
        expect(() => patchSchedule(e.id, { version: e.version, startTime: '10:00', endTime: '11:00' })).toThrow('Version conflict');
    });
});
