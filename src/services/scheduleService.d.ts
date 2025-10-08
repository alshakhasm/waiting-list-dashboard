import type { ScheduleEntry, WaitingListItemId, ORRoomId, SurgeonId } from '../models/types';
export declare const ScheduleService: {
    list(_params?: {
        date?: string;
    }): ScheduleEntry[];
    create(_input: {
        waitingListItemId: WaitingListItemId;
        roomId: ORRoomId;
        surgeonId: SurgeonId;
        date: string;
        startTime: string;
        endTime: string;
        notes?: string;
    }): ScheduleEntry;
    update(_id: string, _patch: Partial<Pick<ScheduleEntry, "startTime" | "endTime" | "status" | "notes">> & {
        version: number;
    }): ScheduleEntry;
    cancel(_id: string): void;
};
