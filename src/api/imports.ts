import { ImportService, type ImportRow } from '../services/importService';
import type { ImportBatch } from '../models/types';

export function postImportsExcel(fileName: string, rows: ImportRow[]): ImportBatch {
  return ImportService.importExcel(fileName, rows);
}
