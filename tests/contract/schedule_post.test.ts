import { describe, it, expect, beforeEach } from '@jest/globals';
import { resetDb, db } from '../../src/lib/store';
import { postImportsExcel } from '../../src/api/imports';
import { postSchedule } from '../../src/api/schedule';

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
      date: '2025-01-01',
      startTime: '08:00',
      endTime: '09:00',
    });
    expect(entry.id).toBeTruthy();
    expect(entry.status).toBe('scheduled');
    expect(entry.version).toBe(1);
  });
});
