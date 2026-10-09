import { describe, expect, it } from 'vitest';
import { notificationTarget, workspaceBasePath } from '@/lib/notifications/notification-target';

const REQ = '11111111-2222-4333-8444-555555555555';
const req = (alertType: string) => ({ alertType, relatedRecordId: REQ, relatedRecordType: 'requisition' });

describe('notificationTarget', () => {
  it('sends an approver to the approval queue with the request opened', () => {
    expect(notificationTarget('/approving-officer', req('pending_approval'))).toBe(`/approving-officer/approvals?open=${REQ}`);
    expect(notificationTarget('/approving-officer', req('alternate_approver'))).toBe(`/approving-officer/approvals?open=${REQ}`);
  });

  it('sends custodians to their fulfillment queue', () => {
    expect(notificationTarget('/it-asset-custodian', req('pending_approval'))).toBe(`/it-asset-custodian/fulfillment?open=${REQ}`);
    expect(notificationTarget('/property-custodian', req('pending_approval'))).toBe(`/property-custodian/fulfillment?open=${REQ}`);
  });

  it('sends outcomes of your own request to My Requisitions', () => {
    expect(notificationTarget('/approving-officer', req('requisition_approved'))).toBe(`/approving-officer/requisitions?open=${REQ}`);
    expect(notificationTarget('/it-asset-custodian', req('requisition_fulfilled'))).toBe(`/it-asset-custodian/requisitions?open=${REQ}`);
    expect(notificationTarget('/employee', req('requisition_rejected'))).toBe(`/employee/requisitions/${REQ}`);
  });

  it('links asset alerts to the asset page for custodians only', () => {
    const lowStock = { alertType: 'low_stock', relatedRecordId: REQ, relatedRecordType: 'asset' };
    expect(notificationTarget('/property-custodian', lowStock)).toBe(`/property-custodian/assets/${REQ}`);
    expect(notificationTarget('/master-admin', lowStock)).toBeNull();
  });

  it('routes Returns & Incidents alerts to the holder list or the custodian queue', () => {
    const ar = (alertType: string) => ({ alertType, relatedRecordId: REQ, relatedRecordType: 'asset_request' });
    expect(notificationTarget('/employee', ar('asset_request_update'))).toBe(`/employee/returns-incidents?open=${REQ}`);
    expect(notificationTarget('/it-asset-custodian', ar('asset_request'))).toBe(`/it-asset-custodian/returns-incidents?open=${REQ}`);
    expect(notificationTarget('/property-custodian', ar('asset_request'))).toBe(`/property-custodian/returns-incidents?open=${REQ}`);
    expect(notificationTarget('/approving-officer', ar('asset_request_update'))).toBeNull();
  });

  it('returns null when there is nothing to open', () => {
    expect(notificationTarget('/approving-officer', { ...req('pending_approval'), relatedRecordId: null })).toBeNull();
    expect(notificationTarget('/management-audit', req('sla_breach'))).toBeNull();
  });
});

describe('workspaceBasePath', () => {
  it('takes the first path segment', () => {
    expect(workspaceBasePath('/approving-officer/approvals')).toBe('/approving-officer');
    expect(workspaceBasePath('/employee/notifications')).toBe('/employee');
    expect(workspaceBasePath('')).toBe('');
  });
});
