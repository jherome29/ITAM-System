// A CSV an administrator opens in Excel. Pure, so vitest (node env) can cover it.

/** What Excel treats as the start of a formula, and a tab or carriage return that can hide one. */
const FORMULA_START = /^[=+\-@\t\r]/;

/**
 * One quoted cell. Text that Excel would run as a formula gets a leading apostrophe, which Excel
 * shows as nothing and does not execute (OWASP "CSV injection"). A real number is left alone: a
 * negative amount is not a formula.
 */
export function csvCell(value: string | number): string {
  const text = String(value);
  const safe = typeof value === 'string' && FORMULA_START.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

/**
 * The rows as CSV text, headers from the first row's keys. Begins with a byte-order mark: without
 * one Excel reads the file as ANSI and garbles "Peña" and the like. CRLF line ends, as Excel writes.
 */
export function toCsv(rows: ReadonlyArray<Record<string, string | number>>): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const lines = [headers.map(csvCell).join(','), ...rows.map((row) => headers.map((h) => csvCell(row[h])).join(','))];
  return '﻿' + lines.join('\r\n');
}
