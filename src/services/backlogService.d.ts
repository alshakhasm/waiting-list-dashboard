import type { WaitingListItem } from '../models/types';
export declare const BacklogService: {
    list(_params?: {
        caseTypeId?: string;
        surgeonId?: string;
        search?: string;
    }): Array<WaitingListItem & {
        maskedMrn: string;
    }>;
};
