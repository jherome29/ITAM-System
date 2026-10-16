// Path segments that should render fully uppercased rather than title-cased
// (e.g. "it-asset-custodian" -> "IT Asset Custodian", "qr-scanner" -> "QR Scanner").
const ACRONYMS = new Set(['it', 'qr', 'ict', 'sla', 'id', 'par', 'ics', 'ris', 'coa', 'kpi']);

// Pages whose title has an ampersand, which an address cannot carry.
const NAMED = new Map([
  ['returns-incidents', 'Returns & Incidents'],
  ['maintenance-disposal', 'Maintenance & Disposal'],
]);

const RECORD_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The words for one address segment in the breadcrumb. */
export function breadcrumbLabel(segment: string): string {
  const named = NAMED.get(segment);
  if (named) return named;
  if (RECORD_ID.test(segment)) return 'Details';
  return segment
    .split('-')
    .map((part) =>
      ACRONYMS.has(part.toLowerCase()) ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1),
    )
    .join(' ');
}
