import { preparePrinterImport } from './printer-import.model.js';
import { printerImportRepository } from './printer-import.repository.js';

export const printerImportService = {
  import: (input: unknown, apply = false) =>
    printerImportRepository.import(preparePrinterImport(input), apply),
};
