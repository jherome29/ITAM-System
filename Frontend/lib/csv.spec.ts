import { describe, expect, it } from 'vitest';
import { csvCell, toCsv } from './csv';

// The audit log exports what is on screen as a CSV that an administrator opens in Excel. A name
// or a record label that starts with = + - or @ is run by Excel as a formula (a crafted
// "=HYPERLINK(...)" account name could phone home), and a file with no byte-order mark opens with
// "Peña" and "Dela Cruz–Santos" garbled.

describe('csvCell', () => {
  it('quotes a value and doubles the quotes inside it', () => {
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
  });

  it.each(['=HYPERLINK("http://x")', '+1+1', '-2+3', '@SUM(A1)', '\tcmd', '\rcmd'])(
    'defuses %j, which Excel would run as a formula',
    (text) => {
      expect(csvCell(text)).toMatch(/^"'/);
    },
  );

  it('leaves ordinary text, dates and ids as they are', () => {
    expect(csvCell('Maria Peña')).toBe('"Maria Peña"');
    expect(csvCell('2026-10-16T06:14:54.000Z')).toBe('"2026-10-16T06:14:54.000Z"');
    expect(csvCell('6a22b98f-72ac-43da-a748-16560c40699f')).toBe('"6a22b98f-72ac-43da-a748-16560c40699f"');
  });

  it('keeps a real number a number, even a negative one', () => {
    expect(csvCell(-5)).toBe('"-5"');
    expect(csvCell(12)).toBe('"12"');
  });
});

describe('toCsv', () => {
  const rows = [
    { User: 'Maria Peña', Action: 'user_login' },
    { User: '=1+1', Action: 'form_generated' },
  ];

  it('starts with a byte-order mark so Excel reads it as UTF-8', () => {
    expect(toCsv(rows).charCodeAt(0)).toBe(0xfeff);
  });

  it('writes the headers first, then a line per row', () => {
    const lines = toCsv(rows).slice(1).split('\r\n');

    expect(lines).toEqual(['"User","Action"', '"Maria Peña","user_login"', `"'=1+1","form_generated"`]);
  });

  it('is empty for no rows', () => {
    expect(toCsv([])).toBe('');
  });
});
