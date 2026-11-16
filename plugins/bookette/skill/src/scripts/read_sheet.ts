/**
 * Print every visible, non-empty sheet of a spreadsheet as tab-separated rows.
 *
 * Usage: node dist/scripts/read_sheet.js <file.xlsx|file.csv>
 */
import { Workbook, type CellValue } from 'exceljs';

import { readCsvText } from '../sheet-text';

export function cellText(value: CellValue): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    // A formula cell: print the cached result, the way a reader sees the value.
    const object = value as { result?: CellValue; formula?: string };
    if (object.result !== undefined && object.result !== null) return cellText(object.result);
    return object.formula ?? '';
  }
  if (typeof value === 'object' && 'richText' in value) {
    return (value as { richText: { text: string }[] }).richText.map((part) => part.text).join('');
  }
  if (typeof value === 'object' && 'hyperlink' in value) {
    const link = value as { text?: string; hyperlink?: string };
    return link.text ?? link.hyperlink ?? '';
  }
  return String(value);
}

export async function readSheet(path: string): Promise<string> {
  if (path.toLowerCase().endsWith('.csv')) {
    return readCsvText(path);
  }
  const workbook = new Workbook();
  await workbook.xlsx.readFile(path);
  const lines: string[] = [];
  for (const sheet of workbook.worksheets) {
    if (sheet.state !== 'visible') {
      lines.push(`## Sheet: ${sheet.name} (${sheet.state}, skipped)`);
      continue;
    }
    const rows: string[][] = [];
    sheet.eachRow((row) => {
      const cells = (row.values as CellValue[]).slice(1).map((cell: CellValue) => cellText(cell));
      if (cells.some((cell) => cell.trim() !== '')) rows.push(cells);
    });
    if (rows.length === 0) {
      lines.push(`## Sheet: ${sheet.name} (empty, skipped)`);
      continue;
    }
    lines.push(`## Sheet: ${sheet.name}`);
    for (const row of rows) lines.push(row.join('\t'));
  }
  return `${lines.join('\n')}\n`;
}

async function main(argv: string[]): Promise<void> {
  const path = argv[0];
  if (path === undefined) throw new Error('usage: read_sheet.js <file.xlsx|file.csv>');
  process.stdout.write(await readSheet(path));
}

if (require.main === module) {
  void main(process.argv.slice(2));
}
