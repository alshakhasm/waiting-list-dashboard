import { describe, it, expect, beforeEach } from '@jest/globals';
import { resetDb, db } from '../../src/lib/store';
import { postImportsExcel } from '../../src/api/imports';
import { postSchedule, patchSchedule } from '../../src/api/schedule';
const futureDate = (days = 7) => new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
describe('ScheduleEntry versioning', () => {
    beforeEach(() => resetDb());
    it('should detect conflicts and increment version', () => {
        postImportsExcel('seed.xlsx', [
            { patientName: 'V', mrn: '010101', procedure: 'Proc', estDurationMin: 30, surgeonId: 's:1' },
        ]);
        const w = Array.from(db.waiting.values())[0];
        const e = postSchedule({ waitingListItemId: w.id, roomId: 'or:1', surgeonId: 's:1', date: futureDate(7), startTime: '08:00', endTime: '09:00' });
        const e2 = patchSchedule(e.id, { version: e.version, notes: 'updated' });
        expect(e2.version).toBe(e.version + 1);
        expect(() => patchSchedule(e.id, { version: e.version, notes: 'stale' })).toThrow('Version conflict');
    });
});
