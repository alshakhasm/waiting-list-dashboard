import { ScheduleService } from '../services/scheduleService';
import type { ScheduleEntry } from '../models/types';

export const postSchedule = ScheduleService.create;
export const patchSchedule = ScheduleService.update;
export const deleteSchedule = ScheduleService.cancel;
export const getScheduleList = ScheduleService.list;

export function getScheduleVersion(entry: ScheduleEntry): number {
  return entry.version;
}
