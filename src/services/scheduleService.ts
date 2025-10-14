import { db } from '../lib/store';
import { newId } from '../lib/id';
import type { ScheduleEntry, WaitingListItemId, ORRoomId, SurgeonId } from '../models/types';

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return !(aEnd <= bStart || bEnd <= aStart);
}

export const ScheduleService = {
  list(params?: { date?: string }): ScheduleEntry[] {
    const all = Array.from(db.schedule.values());
    if (params?.date) return all.filter(e => e.date === params.date);
    return all;
  },
  create(input: { waitingListItemId: WaitingListItemId; roomId: ORRoomId; surgeonId: SurgeonId; date: string; startTime: string; endTime: string; notes?: string }): ScheduleEntry {
    // basic availability checks (room+surgeon not double-booked same date)
    const entries = Array.from(db.schedule.values()).filter(e => e.date === input.date);
    for (const e of entries) {
      if (e.roomId === input.roomId && overlaps(e.startTime, e.endTime, input.startTime, input.endTime)) throw new Error('Room unavailable');
      if (e.surgeonId === input.surgeonId && overlaps(e.startTime, e.endTime, input.startTime, input.endTime)) throw new Error('Surgeon unavailable');
    }
    const id = newId('sch');
    const entry: ScheduleEntry = {
      id,
      waitingListItemId: input.waitingListItemId,
      roomId: input.roomId,
      surgeonId: input.surgeonId,
      date: input.date,
      startTime: input.startTime,
      endTime: input.endTime,
      status: 'scheduled',
      notes: input.notes,
      updatedAt: new Date().toISOString(),
      version: 1,
    };
    db.schedule.set(id, entry);
    return entry;
  },
  update(id: string, patch: Partial<Pick<ScheduleEntry, 'startTime' | 'endTime' | 'status' | 'notes'>> & { version: number }): ScheduleEntry {
    const current = db.schedule.get(id);
    if (!current) throw new Error('Not found');
    if (patch.version !== current.version) throw new Error('Version conflict');
    const updated: ScheduleEntry = { ...current, ...patch, version: current.version + 1, updatedAt: new Date().toISOString() };
    db.schedule.set(id, updated);
    return updated;
  },
  cancel(id: string): void {
    const current = db.schedule.get(id);
    if (!current) return;
    current.status = 'cancelled';
    current.updatedAt = new Date().toISOString();
    current.version += 1;
    db.schedule.set(id, current);
  }
};
