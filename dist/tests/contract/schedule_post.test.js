import { describe, it, expect, beforeEach } from '@jest/globals';
import { resetDb, db } from '../../src/lib/store';
import { postImportsExcel } from '../../src/api/imports';
import { postSchedule } from '../../src/api/schedule';
const futureDate = (days = 7) => new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
describe('POST /schedule', () => {
    beforeEach(() => resetDb());
    it('should validate and create schedule entry', async () => {
        const batch = postImportsExcel('seed.xlsx', [
            { patientName: 'C', mrn: '55556666', procedure: 'Proc', estDurationMin: 45, caseTypeName: 'case:elective', surgeonId: 's:1' },
        ]);
        expect(batch.countsCreated).toBe(1);
        const entry = postSchedule({
            waitingListItemId: Array.from(db.waiting.values())[0].id,
            roomId: 'or:1',
            surgeonId: 's:1',
            date: futureDate(7),
            startTime: '08:00',
            endTime: '09:00',
        });
        expect(entry.id).toBeTruthy();
        expect(entry.status).toBe('scheduled');
        expect(entry.version).toBe(1);
    });
    it('should reject dates in the past or today', async () => {
        postImportsExcel('seed.xlsx', [
            { patientName: 'C', mrn: '55556666', procedure: 'Proc', estDurationMin: 45, caseTypeName: 'case:elective', surgeonId: 's:1' },
        ]);
        const waitingId = Array.from(db.waiting.values())[0].id;
        const today = new Date().toISOString().slice(0, 10);
        expect(() => postSchedule({
            waitingListItemId: waitingId,
            roomId: 'or:1',
            surgeonId: 's:1',
            date: today,
            startTime: '08:00',
            endTime: '09:00',
        })).toThrow('future');
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        expect(() => postSchedule({
            waitingListItemId: waitingId,
            roomId: 'or:1',
            surgeonId: 's:1',
            date: yesterday,
            startTime: '08:00',
            endTime: '09:00',
        })).toThrow('future');
    });
});
