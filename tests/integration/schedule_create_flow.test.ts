import { describe, it, expect, beforeEach } from '@jest/globals';
import { resetDb, db } from '../../src/lib/store';
import { postImportsExcel } from '../../src/api/imports';
import { postSchedule } from '../../src/api/schedule';

describe('Create schedule entry → calendar', () => {
  beforeEach(() => resetDb());

  it('should reflect new entry in calendar data', async () => {
    postImportsExcel('seed.xlsx', [
      { patientName: 'Z', mrn: '88889999', procedure: 'Proc', estDurationMin: 30, surgeonId: 's:1' },
    ]);
    const w = Array.from(db.waiting.values())[0];
    postSchedule({ waitingListItemId: w.id, roomId: 'or:1', surgeonId: 's:1', date: '2025-01-04', startTime: '08:00', endTime: '09:00' });
    const entries = Array.from(db.schedule.values()).filter(e => e.date === '2025-01-04');
    expect(entries.length).toBe(1);
    expect(entries[0]).toMatchObject({ roomId: 'or:1', surgeonId: 's:1', status: 'scheduled' });
  });

  it('should update existing entry for the same waiting list item instead of duplicating', async () => {
    postImportsExcel('seed.xlsx', [
      { patientName: 'Q', mrn: '77776666', procedure: 'Proc', estDurationMin: 45, surgeonId: 's:2' },
    ]);
    const w = Array.from(db.waiting.values())[0];
    const first = postSchedule({ waitingListItemId: w.id, roomId: 'or:2', surgeonId: 's:2', date: '2025-02-01', startTime: '09:00', endTime: '09:45' });
    const second = postSchedule({ waitingListItemId: w.id, roomId: 'or:3', surgeonId: 's:3', date: '2025-02-02', startTime: '10:00', endTime: '11:00' });
    expect(second.id).toBe(first.id);
    expect(second.version).toBe(first.version + 1);
    const entries = Array.from(db.schedule.values()).filter(e => e.waitingListItemId === w.id && e.status !== 'cancelled');
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ date: '2025-02-02', startTime: '10:00', endTime: '11:00', roomId: 'or:3', surgeonId: 's:3', status: 'scheduled' });
  });
});
