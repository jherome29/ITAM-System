import { describe, expect, it } from 'vitest';
import {
  allowedTypes,
  blockingRequest,
  custodianActions,
  fileProblem,
  nextSteps,
  outcomeSummary,
} from '@/lib/asset-requests/asset-request-rules';
import type { AssetRequestStatus, AssetRequestType } from '@/lib/api/asset-requests';

const req = (type: AssetRequestType, status: AssetRequestStatus = 'submitted') => ({ type, status });

describe('asset request button rules (mirror the backend)', () => {
  it('everything is allowed when nothing is open', () => {
    expect(allowedTypes([])).toEqual(['return', 'repair', 'damage', 'loss', 'theft']);
  });

  it('an open return blocks repair/damage/another return but not loss/theft', () => {
    expect(allowedTypes([req('return')])).toEqual(['loss', 'theft']);
    expect(blockingRequest('repair', [req('return', 'approved')])).toBeDefined();
  });

  it('an open loss/theft report blocks everything', () => {
    expect(allowedTypes([req('theft')])).toEqual([]);
  });

  it('closed requests never block', () => {
    expect(allowedTypes([req('return', 'completed'), req('repair', 'rejected'), req('theft', 'cancelled')])).toHaveLength(5);
  });
});

describe('custodianActions', () => {
  it('is two-step: approve or reject, then only mark received', () => {
    expect(custodianActions('submitted')).toEqual(['approve', 'reject']);
    expect(custodianActions('approved')).toEqual(['complete']);
    expect(custodianActions('completed')).toEqual([]);
  });
});

describe('requester guidance', () => {
  const base = {
    handoverDate: '2026-10-18',
    custodianLabel: 'IT Asset Custodian',
    asset: { id: 'a', itemDescription: 'HP EliteBook', components: 'Charger; Laptop bag', propertyNumber: null, serialNumber: null, assetType: 'ICT', assetClass: 'PPE', status: 'issued' },
    resultingStatus: null,
    accountabilityCleared: false,
    requester: { id: 'u', name: 'Ana', employeeId: 'E1', officeOrSection: 'Ops' },
  };

  it('approved return: bring the item and each component; receipt promised', () => {
    const s = nextSteps({ ...base, type: 'return', status: 'approved' });
    expect(s?.bring).toEqual(['HP EliteBook', 'Charger', 'Laptop bag']);
    expect(s?.notes.join(' ')).toMatch(/Oct 18, 2026/);
    expect(s?.notes.join(' ')).toMatch(/Receipt of Returned Property/);
  });

  it('approved theft: supporting documents, not the item', () => {
    const s = nextSteps({ ...base, type: 'theft', status: 'approved' });
    expect(s?.bring[0]).toBe('Police report');
    expect(s?.notes.join(' ')).toMatch(/until COA grants relief/);
  });

  it('no checklist before approval', () => {
    expect(nextSteps({ ...base, type: 'return', status: 'submitted' })).toBeNull();
  });

  it('completion outcome reflects accountability', () => {
    expect(outcomeSummary({ ...base, type: 'return', status: 'completed', accountabilityCleared: true })?.tone).toBe('green');
    expect(outcomeSummary({ ...base, type: 'loss', status: 'completed' })?.text).toMatch(/until COA grants relief/);
    expect(outcomeSummary({ ...base, type: 'repair', status: 'completed', resultingStatus: 'under_repair' })?.tone).toBe('blue');
  });
});

describe('fileProblem', () => {
  const f = (name: string, type: string, size = 1000) => ({ name, type, size });

  it('accepts up to 3 images/PDFs under 5 MB', () => {
    expect(fileProblem([f('a.jpg', 'image/jpeg'), f('b.png', 'image/png'), f('c.pdf', 'application/pdf')])).toBeNull();
  });

  it('flags too many files, wrong types and oversized files', () => {
    expect(fileProblem([1, 2, 3, 4].map((i) => f(`${i}.png`, 'image/png')))).toMatch(/at most 3/);
    expect(fileProblem([f('virus.exe', 'application/x-msdownload')])).toMatch(/JPG, PNG, WEBP or PDF/);
    expect(fileProblem([f('huge.jpg', 'image/jpeg', 6 * 1024 * 1024)])).toMatch(/5 MB/);
  });
});
