import { describe, expect, it } from 'vitest';
import { detailActions, rowActionLabel } from './actions';
import { rowActionMode } from './row-action';

// Every button WorkflowPage offers must correspond to something the backend will
// accept. These rules used to be spread through the component (and, for the sample
// pages, offered buttons that saved nothing); now they are one small table.

describe('detailActions — approvals', () => {
  it('offers Approve / Reject only while the request awaits the officer', () => {
    expect(detailActions('approvals', 'pending_supervisor')).toEqual(['Approve', 'Reject']);
  });
  it('offers nothing once it is decided — a deep-linked old request is view-only', () => {
    for (const status of ['pending_fulfillment', 'rejected', 'fulfilled', 'on_hold', 'cancelled']) {
      expect(detailActions('approvals', status)).toEqual([]);
    }
  });
});

describe('detailActions — My Requisitions', () => {
  it('is view-only: there is no cancel endpoint', () => {
    expect(detailActions('requisitions', 'pending_supervisor')).toEqual([]);
  });
});

describe('detailActions — fulfillment', () => {
  it('lets a custodian fulfil or hold a request that is ready', () => {
    expect(detailActions('fulfillment', 'pending_fulfillment')).toEqual(['Fulfill', 'On Hold']);
  });
  it('lets a held request be fulfilled once stock arrives, but not held again', () => {
    expect(detailActions('fulfillment', 'on_hold')).toEqual(['Fulfill']);
  });
  it('offers nothing for any other status', () => {
    expect(detailActions('fulfillment', 'fulfilled')).toEqual([]);
  });
});

describe('detailActions — custody follows the asset lifecycle', () => {
  it('an available asset can be issued or transferred', () => {
    expect(detailActions('custody', 'available')).toEqual(['Issue', 'Transfer']);
  });
  it('an issued asset can only be taken back — never issued a second time', () => {
    expect(detailActions('custody', 'issued')).toEqual(['Return']);
  });
  it('offers no custody action where the state machine allows none', () => {
    expect(detailActions('custody', 'returned')).toEqual([]);
    expect(detailActions('custody', 'flagged_for_disposal')).toEqual([]);
    expect(detailActions('custody', 'disposed')).toEqual([]);
  });
  it('offers nothing for a status it does not know', () => {
    expect(detailActions('custody', 'whatever')).toEqual([]);
  });
});

describe('detailActions — disposal', () => {
  it('records completed disposal only for flagged unserviceable assets', () => {
    expect(detailActions('disposal', 'flagged_for_disposal', 'unserviceable')).toEqual(['Record Disposal']);
    expect(detailActions('disposal', 'flagged_for_disposal', 'serviceable')).toEqual([]);
    expect(detailActions('disposal', 'available', 'unserviceable')).toEqual([]);
    expect(detailActions('disposal', 'disposed', 'unserviceable')).toEqual([]);
  });
});

describe('row buttons never skip the checks above', () => {
  it('Custody opens the drawer, where only valid actions are offered', () => {
    expect(rowActionMode('custody')).toBe('drawer');
    expect(rowActionLabel('custody')).toBe('Manage');
  });
  it('Fulfilment confirms directly and disposal opens the record first', () => {
    expect(rowActionMode('fulfillment')).toBe('confirm');
    expect(rowActionLabel('fulfillment')).toBe('Fulfill');
    expect(rowActionMode('disposal')).toBe('drawer');
    expect(rowActionLabel('disposal')).toBe('Manage');
  });
  it('approvals and requisitions open the drawer', () => {
    expect(rowActionMode('approvals')).toBe('drawer');
    expect(rowActionLabel('approvals')).toBe('Review');
    expect(rowActionMode('requisitions')).toBe('drawer');
    expect(rowActionLabel('requisitions')).toBe('Open');
  });
});
