import { ScheduleService } from '../services/scheduleService';
export const postSchedule = ScheduleService.create;
export const patchSchedule = ScheduleService.update;
export const deleteSchedule = ScheduleService.cancel;
export const getScheduleList = ScheduleService.list;
export function getScheduleVersion(entry) {
    return entry.version;
}
