export declare const ExportService: {
    week(_date: string): Array<{
        name: string;
        maskedMrn: string;
        caseTypeId: string;
        procedure: string;
        room?: string;
        start?: string;
        end?: string;
        surgeon?: string;
    }>;
};
