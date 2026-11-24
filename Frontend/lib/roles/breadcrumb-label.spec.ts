import { describe, expect, it } from 'vitest';
import { breadcrumbLabel } from './breadcrumb-label';

// The crumb was made from the address, so "returns-incidents" read "Returns
// Incidents" while the page itself is titled "Returns & Incidents".
describe('breadcrumbLabel', () => {
  it('title-cases an ordinary address segment', () => {
    expect(breadcrumbLabel('approval-history')).toBe('Approval History');
    expect(breadcrumbLabel('dashboard')).toBe('Dashboard');
  });

  it('upper-cases acronyms', () => {
    expect(breadcrumbLabel('it-asset-custodian')).toBe('IT Asset Custodian');
    expect(breadcrumbLabel('qr-scanner')).toBe('QR Scanner');
  });

  // An asset's or a requisition's own page has its record id in the address. The crumb
  // read "C22e89ef 6075 4b04 A4cc 824bfbe56649": a code, not words.
  it('calls a record\'s page "Details", never its id', () => {
    expect(breadcrumbLabel('c22e89ef-6075-4b04-a4cc-824bfbe56649')).toBe('Details');
    expect(breadcrumbLabel('C22E89EF-6075-4B04-A4CC-824BFBE56649')).toBe('Details');
  });

  it('still title-cases a segment that merely contains digits or hyphens', () => {
    expect(breadcrumbLabel('physical-inventory')).toBe('Physical Inventory');
  });

  it('writes the pages that are named with an ampersand the way their titles are', () => {
    expect(breadcrumbLabel('returns-incidents')).toBe('Returns & Incidents');
    expect(breadcrumbLabel('maintenance-disposal')).toBe('Maintenance & Disposal');
  });
});
