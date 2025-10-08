export type LegendEntry = {
    key: string;
    label: string;
    color: string;
};
export declare function getLegend(_themeName: 'default' | 'high-contrast'): LegendEntry[];
