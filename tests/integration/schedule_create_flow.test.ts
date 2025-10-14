import { describe, it, expect, beforeEach } from '@jest/globals';
import { resetDb, db } from '../../src/lib/store';
import { postImportsExcel } from '../../src/api/imports';
import { postSchedule } from '../../src/api/schedule';

const futureDate = (days = 7) => new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

describe('Create schedule entry → calendar', () => {
  beforeEach(() => resetDb());

  it('should reflect new entry in calendar data', async () => {
    postImportsExcel('seed.xlsx', [
      { patientName: 'Z', mrn: '88889999', procedure: 'Proc', estDurationMin: 30, surgeonId: 's:1' },
    ]);
    const w = Array.from(db.waiting.values())[0];
    const day = futureDate(7);
    postSchedule({ waitingListItemId: w.id, roomId: 'or:1', surgeonId: 's:1', date: day, startTime: '08:00', endTime: '09:00' });
    const entries = Array.from(db.schedule.values()).filter(e => e.date === day);
    expect(entries.length).toBe(1);
    expect(entries[0]).toMatchObject({ roomId: 'or:1', surgeonId: 's:1', status: 'scheduled' });
  });

  it('should update existing entry for the same waiting list item instead of duplicating', async () => {
    postImportsExcel('seed.xlsx', [
      { patientName: 'Q', mrn: '77776666', procedure: 'Proc', estDurationMin: 45, surgeonId: 's:2' },
    ]);
    const w = Array.from(db.waiting.values())[0];
    const firstDate = futureDate(8);
    const secondDate = futureDate(9);
    const first = postSchedule({ waitingListItemId: w.id, roomId: 'or:2', surgeonId: 's:2', date: firstDate, startTime: '09:00', endTime: '09:45' });
    // Simulate a stale duplicate lingering in the schedule store
    const dupId = 'sch-dup';
    db.schedule.set(dupId, { ...first, id: dupId, startTime: '09:30', endTime: '10:10', version: first.version, updatedAt: first.updatedAt });
    const second = postSchedule({ waitingListItemId: w.id, roomId: 'or:3', surgeonId: 's:3', date: secondDate, startTime: '10:00', endTime: '11:00' });
    expect(second.id).toBe(first.id);
    expect(second.version).toBe(first.version + 1);
    const entries = Array.from(db.schedule.values()).filter(e => e.waitingListItemId === w.id && e.status !== 'cancelled');
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ date: secondDate, startTime: '10:00', endTime: '11:00', roomId: 'or:3', surgeonId: 's:3', status: 'scheduled' });
  });
});
