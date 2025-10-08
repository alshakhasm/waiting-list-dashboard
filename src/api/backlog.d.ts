export declare const listBacklog: (_params?: {
    caseTypeId?: string;
    surgeonId?: string;
    search?: string;
}) => Array<import("../models/types").WaitingListItem & {
    maskedMrn: string;
}>;
