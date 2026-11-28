import { describe, expect, it } from 'vitest';
import { DEFAULT_PAGE_SIZE, clampPage, pageCount, pageRange, pageSlice } from './pagination';

// With a few hundred records, a list that rendered every row stalled the browser for one
// to two seconds (the audit log, the requests queue, the repairs queue, My Assigned
// Assets). Client-side lists now show one page at a time.

const items = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

describe('pageCount', () => {
  it('rounds up, and is never less than one page, even for an empty list', () => {
    expect(pageCount(0)).toBe(1);
    expect(pageCount(1)).toBe(1);
    expect(pageCount(DEFAULT_PAGE_SIZE)).toBe(1);
    expect(pageCount(DEFAULT_PAGE_SIZE + 1)).toBe(2);
    expect(pageCount(163, 25)).toBe(7);
  });
});

describe('clampPage', () => {
  it('keeps a page inside the list: a filter that shrinks it cannot strand you past the end', () => {
    expect(clampPage(5, 30, 25)).toBe(2);
    expect(clampPage(0, 30, 25)).toBe(1);
    expect(clampPage(-3, 30, 25)).toBe(1);
    expect(clampPage(3, 0, 25)).toBe(1);
  });

  it('copes with a page that is not a whole number', () => {
    expect(clampPage(Number.NaN, 100, 25)).toBe(1);
    expect(clampPage(2.7, 100, 25)).toBe(2);
  });
});

describe('pageSlice', () => {
  it('returns one page of the list', () => {
    expect(pageSlice(items(60), 1, 25)).toEqual(items(25));
    expect(pageSlice(items(60), 2, 25)[0]).toBe(26);
    expect(pageSlice(items(60), 3, 25)).toEqual([51, 52, 53, 54, 55, 56, 57, 58, 59, 60]);
  });

  it('shows the last page when asked for one past the end', () => {
    expect(pageSlice(items(30), 9, 25)).toEqual([26, 27, 28, 29, 30]);
  });

  it('is empty for an empty list, and does not change the list it is given', () => {
    const list = items(30);
    expect(pageSlice([], 1, 25)).toEqual([]);
    pageSlice(list, 2, 25);
    expect(list).toEqual(items(30));
  });
});

describe('pageRange', () => {
  it('says which records a page shows, counting from 1', () => {
    expect(pageRange(1, 163, 25)).toEqual({ from: 1, to: 25 });
    expect(pageRange(7, 163, 25)).toEqual({ from: 151, to: 163 });
  });

  it('is 0 to 0 for an empty list', () => {
    expect(pageRange(1, 0, 25)).toEqual({ from: 0, to: 0 });
  });
});
