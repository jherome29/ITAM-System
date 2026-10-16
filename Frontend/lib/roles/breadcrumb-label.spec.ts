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

  it('writes the pages that are named with an ampersand the way their titles are', () => {
    expect(breadcrumbLabel('returns-incidents')).toBe('Returns & Incidents');
    expect(breadcrumbLabel('maintenance-disposal')).toBe('Maintenance & Disposal');
  });
});
