import { ImportService } from '../services/importService';
export function postImportsExcel(fileName, rows, mapping) {
    return ImportService.importExcel(fileName, rows, mapping);
}
