import { describe, expect, it } from 'vitest';
import type { AuditLog } from '@/lib/api/audit';
import { describeHistory, historyEntries, lastTransfer, roleLabel } from './asset-history';

// The asset page's "Transaction History" shows the asset's audit trail. It read
// `res.data?.data` while the API returns the list directly under `data`, so it
// was empty for every asset. These tests pin what a row says once it has data.

const log = (over: Partial<AuditLog> = {}): AuditLog => ({
  id: 'log-1',
  userId: 'user-1',
  userRole: 'it_personnel',
  action: 'asset_updated',
  affectedRecordId: 'asset-1',
  affectedRecordType: 'asset',
  ipAddress: '::1',
  metadata: null,
  timestamp: '2026-10-15T11:02:00.000Z',
  ...over,
});

describe('roleLabel', () => {
  it('names a role the way the screens do', () => {
    expect(roleLabel('it_personnel')).toBe('IT Asset Custodian');
    expect(roleLabel('supervisor')).toBe('Approving Officer');
    expect(roleLabel('system_admin')).toBe('Master Administrator');
  });

  it('falls back to a readable form of an unknown role', () => {
    expect(roleLabel('field_agent')).toBe('Field agent');
  });
});

describe('describeHistory', () => {
  it('says where a transferred asset went and what it moved from and to', () => {
    const entry = describeHistory(
      log({
        action: 'asset_transferred',
        metadata: {
          fromStatus: 'available',
          toStatus: 'transferred',
          toLocation: 'Cyber Intelligence Unit, 4th Floor',
          notes: 'Moved for the audit.',
        },
      }),
    );

    expect(entry.event).toBe('Transferred');
    expect(entry.by).toBe('IT Asset Custodian');
    expect(entry.details).toEqual([
      'Available → Transferred',
      'To: Cyber Intelligence Unit, 4th Floor',
      'Moved for the audit.',
    ]);
  });

  it('says where an asset now sits when it arrives', () => {
    const entry = describeHistory(
      log({
        action: 'asset_updated',
        metadata: {
          fromStatus: 'transferred',
          toStatus: 'available',
          officeOrSection: 'Cyber Intelligence Unit',
          officeLocation: 'Intelligence Room, 4th Floor',
        },
      }),
    );

    expect(entry.event).toBe('Made available');
    expect(entry.details).toEqual([
      'Transferred → Available',
      'Now at: Cyber Intelligence Unit · Intelligence Room, 4th Floor',
    ]);
  });

  it('tells a field edit from a status change, and names what was edited', () => {
    const entry = describeHistory(
      log({ action: 'asset_updated', metadata: { updatedFields: ['officeOrSection', 'officeLocation'] } }),
    );

    expect(entry.event).toBe('Details edited');
    expect(entry.details).toEqual(['Changed: office or section, office location']);
  });

  it('reports an edit that changed nothing without inventing fields', () => {
    expect(describeHistory(log({ metadata: { updatedFields: [] } })).details).toEqual([]);
  });

  it.each([
    ['asset_created', 'Registered'],
    ['asset_issued', 'Issued'],
    ['asset_returned', 'Returned'],
    ['asset_flagged_repair', 'Sent to repair'],
    ['asset_flagged_disposal', 'Flagged for disposal'],
    ['asset_disposed', 'Disposed'],
    ['qr_generated', 'QR code generated'],
    ['repair_updated', 'Repair progress logged'],
    ['repair_completed', 'Repair completed'],
    ['form_generated', 'Form generated'],
  ])('names %s as "%s"', (action, event) => {
    expect(describeHistory(log({ action })).event).toBe(event);
  });

  it('falls back to the action in words for one it does not know', () => {
    expect(describeHistory(log({ action: 'something_new_happened' })).event).toBe('Something new happened');
  });

  it('copes with missing metadata and an unknown role', () => {
    const entry = describeHistory(log({ metadata: null, userRole: '' }));

    expect(entry.details).toEqual([]);
    expect(entry.by).toBe('System');
  });
});

describe('historyEntries', () => {
  it('lists the newest event first', () => {
    const entries = historyEntries([
      log({ id: 'old', timestamp: '2026-10-01T08:00:00Z' }),
      log({ id: 'new', timestamp: '2026-10-15T08:00:00Z' }),
      log({ id: 'mid', timestamp: '2026-10-08T08:00:00Z' }),
    ]);

    expect(entries.map((e) => e.id)).toEqual(['new', 'mid', 'old']);
  });

  it('is an empty list for no history or a response that is not a list', () => {
    expect(historyEntries([])).toEqual([]);
    expect(historyEntries(undefined)).toEqual([]);
    expect(historyEntries({ data: [log()] } as unknown as AuditLog[])).toEqual([]);
  });
});

describe('lastTransfer', () => {
  const move = (over: Record<string, unknown>) => ({
    action: 'asset_transferred',
    toLocation: 'Records Section',
    timestamp: '2026-10-01T08:00:00Z',
    ...over,
  });

  it('is the destination and time of the latest transfer', () => {
    expect(
      lastTransfer([move({}), move({ toLocation: 'Cyber Intelligence Unit', timestamp: '2026-10-15T08:00:00Z' })]),
    ).toEqual({ to: 'Cyber Intelligence Unit', at: '2026-10-15T08:00:00Z' });
  });

  it('ignores moves that are not transfers or have no destination', () => {
    expect(lastTransfer([move({ action: 'asset_issued' }), move({ toLocation: null })])).toBeNull();
    expect(lastTransfer(undefined)).toBeNull();
    expect(lastTransfer([])).toBeNull();
  });
});
