import { OfficialFormType } from '../../../packages/shared/src/enums';
import {
  DOCUMENT_SERIES,
  allocateDocumentNumber,
  formatDocumentNumber,
} from './document-numbers';

describe('formatDocumentNumber', () => {
  it('prints series, year and a zero-padded running number', () => {
    expect(formatDocumentNumber('PAR', 2026, 7)).toBe('PAR-2026-0007');
    expect(formatDocumentNumber('RLSDDP', 2026, 12345)).toBe(
      'RLSDDP-2026-12345',
    );
  });
});

describe('DOCUMENT_SERIES', () => {
  it('numbers the per-transaction forms and leaves the periodic reports alone', () => {
    expect(DOCUMENT_SERIES[OfficialFormType.PAR]).toBe('PAR');
    expect(DOCUMENT_SERIES[OfficialFormType.ICS]).toBe('ICS');
    expect(DOCUMENT_SERIES[OfficialFormType.PTR]).toBe('PTR');
    expect(DOCUMENT_SERIES[OfficialFormType.RECEIPT_RETURNED_SEP]).toBe('RRSP');
    // Counted on a schedule, not issued per transaction.
    expect(DOCUMENT_SERIES[OfficialFormType.RPCI]).toBeUndefined();
    // Already carries the requisition's own number.
    expect(DOCUMENT_SERIES[OfficialFormType.RIS]).toBeUndefined();
  });

  it('gives every series a distinct prefix', () => {
    const prefixes = Object.values(DOCUMENT_SERIES);
    expect(new Set(prefixes).size).toBe(prefixes.length);
  });
});

describe('allocateDocumentNumber', () => {
  it('takes the next value of the series for the year, in one statement', async () => {
    const query = jest.fn().mockResolvedValue([{ last_value: 42 }]);

    const number = await allocateDocumentNumber({ query }, 'PTR', 2026);

    expect(number).toBe('PTR-2026-0042');
    expect(query).toHaveBeenCalledTimes(1);
    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    // Atomic increment, parameterised - two custodians generating at once must
    // not be handed the same number.
    expect(sql).toMatch(/ON CONFLICT/i);
    expect(sql).toMatch(/RETURNING/i);
    expect(params).toEqual(['PTR', 2026]);
  });
});
