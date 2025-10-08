import { type ImportRow } from '../services/importService';
import type { ImportBatch, MappingProfile } from '../models/types';
export declare function postImportsExcel(_fileName: string, _rows: ImportRow[], _mapping?: MappingProfile): ImportBatch;
