import type { WaitingListItem } from '../models/types';
export declare const BacklogService: {
    list(params?: {
        caseTypeId?: string;
        surgeonId?: string;
        search?: string;
    }): Array<WaitingListItem & {
        maskedMrn: string;
    }>;
};
