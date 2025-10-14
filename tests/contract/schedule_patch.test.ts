import { describe, it, expect, beforeEach } from '@jest/globals';
import { resetDb, db } from '../../src/lib/store';
import { postImportsExcel } from '../../src/api/imports';
import { postSchedule, patchSchedule } from '../../src/api/schedule';

const futureDate = (days = 7) => new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

describe('PATCH /schedule/{id}', () => {
  beforeEach(() => resetDb());

  it('should enforce optimistic concurrency', async () => {
    postImportsExcel('seed.xlsx', [
      { patientName: 'D', mrn: '77778888', procedure: 'Proc', estDurationMin: 30, caseTypeName: 'case:elective', surgeonId: 's:1' },
    ]);
    const created = postSchedule({
      waitingListItemId: Array.from(db.waiting.values())[0].id,
      roomId: 'or:1',
      surgeonId: 's:1',
      date: futureDate(7),
      startTime: '08:00',
      endTime: '09:00',
    });
    const v1 = created.version;
    const updated = patchSchedule(created.id, { version: v1, startTime: '09:00', endTime: '10:00' });
    expect(updated.version).toBe(v1 + 1);
    // Try with stale version
    expect(() => patchSchedule(created.id, { version: v1, startTime: '10:00', endTime: '11:00' })).toThrow('Version conflict');
  });
});
