import { OfficialFormType } from '../../../packages/shared/src/enums';

// Forms that are issued once per transaction carry their own running number.
// They used to print one that was invented at render time - the property number
// as the PAR No., "ICS-" + property number, "RRSP-" + the clock - so two forms
// could share a number and the same form never had the same one twice.
//
// RIS is absent on purpose: it prints the requisition's own number. The
// periodic reports (RPCI, RPCPPE, RSMI, RSPI, WMR, Annex A.4) are identified by
// the period they cover, not a serial.
export const DOCUMENT_SERIES: Partial<Record<OfficialFormType, string>> = {
  [OfficialFormType.PAR]: 'PAR',
  [OfficialFormType.ICS]: 'ICS',
  [OfficialFormType.PTR]: 'PTR',
  [OfficialFormType.IAR]: 'IAR',
  [OfficialFormType.RECEIPT_RETURNED_PROPERTY]: 'RRPE',
  [OfficialFormType.RECEIPT_RETURNED_SEP]: 'RRSP',
  [OfficialFormType.RLSDDP]: 'RLSDDP',
  [OfficialFormType.MOVE_OUT]: 'MOF',
};

export function formatDocumentNumber(
  series: string,
  year: number,
  sequence: number,
): string {
  return `${series}-${year}-${String(sequence).padStart(4, '0')}`;
}

/** Anything with TypeORM's `query()` - an EntityManager or a test double. */
interface Queryable {
  query(sql: string, params: unknown[]): Promise<unknown>;
}

/**
 * Hands out the next number of a series for a year. Call it inside the same
 * transaction that stores the form: the row lock then serialises two people
 * generating at once, and a form that fails to generate rolls its number back
 * so the series has no holes (COA reviewers ask about gaps).
 *
 * SVC: Deliver and Support - controlled documents.
 */
export async function allocateDocumentNumber(
  db: Queryable,
  series: string,
  year: number,
): Promise<string> {
  const rows = (await db.query(
    `INSERT INTO document_counters (series, year, last_value)
     VALUES ($1, $2, 1)
     ON CONFLICT (series, year)
     DO UPDATE SET last_value = document_counters.last_value + 1
     RETURNING last_value`,
    [series, year],
  )) as Array<{ last_value: number }>;
  return formatDocumentNumber(series, year, rows[0].last_value);
}
