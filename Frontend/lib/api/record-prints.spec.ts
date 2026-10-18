import { describe, expect, it } from 'vitest';
import { printFilePath, printListPath, printPath, printKindWords } from './record-prints';

// CICC asked for a paper copy after every step. A requisition, a return / incident request and a repair each
// have a Print copy button; these are the addresses it talks to. A stored print is read back through the same
// route the record's other documents use where there is one, so the people on the record can reach it.

describe('record print paths', () => {
  it('makes a print through the record it belongs to', () => {
    expect(printPath('requisition', 'r-1')).toBe('/v1/requisitions/r-1/print');
    expect(printPath('asset_request', 'a-1')).toBe('/v1/asset-requests/a-1/print');
    expect(printPath('repair', 'p-1')).toBe('/v1/repairs/p-1/print');
  });

  it('lists the prints of a record', () => {
    expect(printListPath('requisition', 'r-1')).toBe('/v1/requisitions/r-1/prints');
    expect(printListPath('asset_request', 'a-1')).toBe('/v1/asset-requests/a-1/prints');
    expect(printListPath('repair', 'p-1')).toBe('/v1/repairs/p-1/prints');
  });

  it('reads a stored print back through the route the record already uses for its documents', () => {
    expect(printFilePath('requisition', 'r-1', 'f-1')).toBe('/v1/requisitions/r-1/documents/f-1');
    expect(printFilePath('asset_request', 'a-1', 'f-1')).toBe('/v1/asset-requests/a-1/documents/f-1');
    expect(printFilePath('repair', 'p-1', 'f-1')).toBe('/v1/repairs/p-1/prints/f-1');
  });

  it('names each kind in words a person would use', () => {
    expect(printKindWords('requisition')).toBe('requisition');
    expect(printKindWords('asset_request')).toBe('request');
    expect(printKindWords('repair')).toBe('repair');
  });
});
