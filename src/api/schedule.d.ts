import type { ScheduleEntry } from '../models/types';
export declare const postSchedule: (input: {
    waitingListItemId: import("../models/types").WaitingListItemId;
    roomId: import("../models/types").ORRoomId;
    surgeonId: import("../models/types").SurgeonId;
    date: string;
    startTime: string;
    endTime: string;
    notes?: string;
}) => ScheduleEntry;
export declare const patchSchedule: (id: string, patch: Partial<Pick<ScheduleEntry, "startTime" | "endTime" | "status" | "notes">> & {
    version: number;
}) => ScheduleEntry;
export declare const deleteSchedule: (id: string) => void;
export declare const getScheduleList: (params?: {
    date?: string;
}) => ScheduleEntry[];
export declare function getScheduleVersion(entry: ScheduleEntry): number;
