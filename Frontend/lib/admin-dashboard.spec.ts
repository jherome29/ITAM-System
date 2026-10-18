import { describe, expect, it } from 'vitest';
import type { AdminDashboardStats } from './api/admin';
import {
  auditActor,
  buildAttention,
  decisionDetail,
  decisionHref,
  decisionTotal,
  watcherResult,
} from './admin-dashboard';

// The Administration Overview: what needs the administrator, and what the watcher panel says. The numbers come
// from the API (checked against the database in Backend/test/admin-dashboard.e2e-spec.ts); these are the words
// and the rules around them.

const stats = (over: Partial<AdminDashboardStats> = {}): AdminDashboardStats => ({
  users: { total: 10, active: 9, inactive: 1, locked: 0, byRole: {} },
  requisitions: { pendingSupervisor: 0, slaBreached: 0 },
  assets: { total: 50, available: 20, lowStock: 0 },
  audit: { failedLoginsToday: 0, eventsToday: 0 },
  decisions: { returnsIncidents: 0, repairs: 0, requisitions: 0 },
  generatedAt: '2026-10-18T10:00:00.000Z',
  ...over,
});
const healthy = { status: 'ok', db: true, uptime: 100, reachable: true };

describe('what waits for the administrator', () => {
  it('adds the three queues up', () => {
    expect(decisionTotal({ returnsIncidents: 2, repairs: 1, requisitions: 4 })).toBe(7);
    expect(decisionTotal({ returnsIncidents: 0, repairs: 0, requisitions: 0 })).toBe(0);
  });

  it('says plainly when nothing is waiting', () => {
    expect(decisionDetail({ returnsIncidents: 0, repairs: 0, requisitions: 0 })).toBe('Nothing is waiting for you');
  });

  it('breaks the total down by queue, leaving out the empty ones', () => {
    expect(decisionDetail({ returnsIncidents: 2, repairs: 0, requisitions: 1 })).toBe('2 returns & incidents · 1 to fulfil');
    expect(decisionDetail({ returnsIncidents: 1, repairs: 3, requisitions: 0 })).toBe('1 return & incident · 3 repairs');
  });

  it('links the card to the first queue that has something, and nowhere when there is nothing', () => {
    expect(decisionHref({ returnsIncidents: 0, repairs: 2, requisitions: 1 })).toBe('/master-admin/repairs');
    expect(decisionHref({ returnsIncidents: 1, repairs: 2, requisitions: 1 })).toBe('/master-admin/returns-incidents');
    expect(decisionHref({ returnsIncidents: 0, repairs: 0, requisitions: 3 })).toBe('/master-admin/fulfillment');
    expect(decisionHref({ returnsIncidents: 0, repairs: 0, requisitions: 0 })).toBeUndefined();
  });
});

describe('items needing attention', () => {
  it('lists each queue that is waiting, each linking to its own screen', () => {
    const items = buildAttention(stats({ decisions: { returnsIncidents: 2, repairs: 1, requisitions: 3 } }), healthy);

    expect(items.map((i) => i.href)).toEqual([
      '/master-admin/returns-incidents',
      '/master-admin/repairs',
      '/master-admin/fulfillment',
    ]);
    expect(items[0].text).toBe('2 return / incident requests filed by a custodian are waiting for your decision.');
    expect(items[1].text).toBe("1 repair of a custodian's own item is waiting for your decision.");
    expect(items[2].text).toBe('3 requisitions filed by a custodian are waiting for you to fulfil.');
  });

  it('is empty when nothing is wrong, so the panel can say all clear', () => {
    expect(buildAttention(stats(), healthy)).toEqual([]);
  });

  it('still reports past-SLA requisitions as information, with no link (the administrator has no approval screen)', () => {
    const [item] = buildAttention(stats({ requisitions: { pendingSupervisor: 11, slaBreached: 11 } }), healthy);

    expect(item.text).toBe('11 requisitions past the 24-hour approval SLA.');
    expect(item.href).toBeUndefined();
  });

  it('keeps the other alerts: unreachable database, locked accounts, low stock, failed logins', () => {
    const items = buildAttention(
      stats({
        users: { total: 10, active: 9, inactive: 1, locked: 1, byRole: {} },
        assets: { total: 50, available: 20, lowStock: 2 },
        audit: { failedLoginsToday: 12, eventsToday: 30 },
      }),
      { status: 'down', db: false, uptime: 0, reachable: true },
    );

    expect(items.map((i) => i.text)).toEqual([
      'Database unreachable — GET /api/health is reporting the connection down.',
      '1 account locked out of sign-in.',
      '2 supply lines at or below reorder level.',
      '12 failed login attempts recorded today.',
    ]);
  });
});

describe('who did it, in the recent audit activity', () => {
  const entry = (over: Partial<{ userName: string | null; metadata: Record<string, unknown> | null }>) => ({
    userName: 'Juan dela Cruz',
    metadata: null,
    ...over,
  });

  it('names the person', () => {
    expect(auditActor(entry({}))).toBe('Juan dela Cruz');
  });

  // The SLA watcher reassigns a requisition and files the audit entry under the REQUESTER (who the entry is
  // about), so naming the account would say the requester did something the system did.
  it('says "System (automatic)" for what the system did by itself, whoever the entry is filed under', () => {
    expect(auditActor(entry({ metadata: { systemInitiated: true } }))).toBe('System (automatic)');
  });

  it('has nothing to say when the account no longer resolves', () => {
    expect(auditActor(entry({ userName: null }))).toBeNull();
    expect(auditActor(entry({ userName: undefined }))).toBeNull();
  });
});

describe('what a background watcher says', () => {
  const run = (count: number) => ({ at: '2026-10-18T10:00:00.000Z', trigger: 'hourly-cron' as const, count });

  // The watcher counts only NEW alerts (each one is sent once), so "Nothing to alert" read as "no problems" even
  // while the card above said 11 requisitions were past SLA.
  it('says how many NEW alerts it sent, not that there is nothing to alert', () => {
    expect(watcherResult(run(0), 'every hour').text).toBe('0 new alerts sent');
    expect(watcherResult(run(1), 'every hour').text).toBe('1 new alert sent');
    expect(watcherResult(run(3), 'every hour').text).toBe('3 new alerts sent');
  });

  it('is amber when it sent something and neutral when it did not', () => {
    expect(watcherResult(run(3), 'every hour').tone).toBe('amber');
    expect(watcherResult(run(0), 'every hour').tone).toBe('neutral');
  });

  it('says it failed, in red, when the last run threw', () => {
    expect(watcherResult(run(-1), 'every hour')).toEqual({ text: 'Failed — see server log', tone: 'red' });
  });

  // "Not run yet" is what every daily row says after each deploy (the record lives in memory), which read like a fault.
  it('explains a watcher that has not run since the last restart, without sounding broken', () => {
    expect(watcherResult(undefined, 'daily at 7:00 AM')).toEqual({
      text: 'Runs daily at 7:00 AM; not yet since the last restart',
      tone: 'muted',
    });
    expect(watcherResult(undefined, 'every hour').text).toBe('Runs every hour; not yet since the last restart');
  });
});
