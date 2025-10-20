import { ImportService } from '../services/importService';
export function postImportsExcel(fileName, rows) {
    return ImportService.importExcel(fileName, rows);
}
