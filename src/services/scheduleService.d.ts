import type { ScheduleEntry, WaitingListItemId, ORRoomId, SurgeonId } from '../models/types';
export declare const ScheduleService: {
    list(params?: {
        date?: string;
    }): ScheduleEntry[];
    create(input: {
        waitingListItemId: WaitingListItemId;
        roomId: ORRoomId;
        surgeonId: SurgeonId;
        date: string;
        startTime: string;
        endTime: string;
        notes?: string;
    }): ScheduleEntry;
    update(id: string, patch: Partial<Pick<ScheduleEntry, "startTime" | "endTime" | "status" | "notes">> & {
        version: number;
    }): ScheduleEntry;
    cancel(id: string): void;
};
