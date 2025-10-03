import { describe, it, expect, beforeEach } from '@jest/globals';
import { resetDb, db } from '../../src/lib/store';
import { postImportsExcel } from '../../src/api/imports';
import { postSchedule, deleteSchedule } from '../../src/api/schedule';
describe('DELETE /schedule/{id}', () => {
    beforeEach(() => resetDb());
    it('should cancel entry and be idempotent', async () => {
        postImportsExcel('seed.xlsx', [
            { patientName: 'E', mrn: '12121212', procedure: 'Proc', estDurationMin: 30, caseTypeName: 'case:elective', surgeonId: 's:1' },
        ]);
        const created = postSchedule({
            waitingListItemId: Array.from(db.waiting.values())[0].id,
            roomId: 'or:1',
            surgeonId: 's:1',
            date: '2025-01-03',
            startTime: '08:00',
            endTime: '09:00',
        });
        deleteSchedule(created.id);
        const after1 = Array.from(db.schedule.values()).find(e => e.id === created.id);
        expect(after1.status).toBe('cancelled');
        const v = after1.version;
        // Idempotent
        deleteSchedule(created.id);
        const after2 = Array.from(db.schedule.values()).find(e => e.id === created.id);
        expect(after2.status).toBe('cancelled');
        expect(after2.version).toBe(v + 1);
    });
});
