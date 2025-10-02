import { type ImportRow } from '../services/importService';
import type { ImportBatch, MappingProfile } from '../models/types';
export declare function postImportsExcel(fileName: string, rows: ImportRow[], mapping?: MappingProfile): ImportBatch;
