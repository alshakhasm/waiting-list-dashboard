import { type ImportRow } from '../services/importService';
import type { ImportBatch } from '../models/types';
export declare function postImportsExcel(_fileName: string, _rows: ImportRow[]): ImportBatch;
