import { ImportService, type ImportRow } from '../services/importService';
import type { ImportBatch, MappingProfile } from '../models/types';

export function postImportsExcel(fileName: string, rows: ImportRow[], mapping?: MappingProfile): ImportBatch {
  return ImportService.importExcel(fileName, rows, mapping);
}
