import { describe, it, expect, beforeEach } from '@jest/globals';
import { resetDb, db } from '../../src/lib/store';
import { postImportsExcel } from '../../src/api/imports';
import { postSchedule, patchSchedule } from '../../src/api/schedule';

const futureDate = (days = 7) => new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

describe('Schedule operated flow', () => {
  beforeEach(() => resetDb());

  it('should move a confirmed case to operated status', () => {
    postImportsExcel('seed.xlsx', [
      { patientName: 'Op Case', mrn: '900199', procedure: 'Proc', estDurationMin: 60, surgeonId: 's:1' },
    ]);
    const waiting = Array.from(db.waiting.values())[0];
    const created = postSchedule({
      waitingListItemId: waiting.id,
      roomId: 'or:1',
      surgeonId: 's:1',
      date: futureDate(7),
      startTime: '08:00',
      endTime: '09:00',
    });
    const confirmed = patchSchedule(created.id, { version: created.version, status: 'confirmed' });
    expect(confirmed.status).toBe('confirmed');
    const operated = patchSchedule(created.id, { version: confirmed.version, status: 'operated' });
    expect(operated.status).toBe('operated');
    const entries = Array.from(db.schedule.values()).filter(e => e.waitingListItemId === waiting.id);
    expect(entries).toHaveLength(1);
    expect(entries[0].status).toBe('operated');
  });
});
