export declare const listBacklog: (params?: {
    caseTypeId?: string;
    surgeonId?: string;
    search?: string;
}) => Array<import("../models/types").WaitingListItem & {
    maskedMrn: string;
}>;
