import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadAccounts, parseArgs } from './seed';

// The accounts path comes from an environment variable, which CodeQL treats as
// sensitive (js/clear-text-logging). It is also just not useful in a log, so
// nothing the seed prints or throws may repeat it.

function messageFor(path: string): string {
  try {
    loadAccounts(path);
  } catch (e) {
    return (e as Error).message;
  }
  return '';
}

// Two scenarios share one runner. The wrong one running against the shared database
// writes permanent audit rows, so the choice must be explicit and a typo must stop the run.
describe('parseArgs scenario', () => {
  const parse = (...argv: string[]) => parseArgs(argv, {});

  it('defaults to the base scenario and to a dry run', () => {
    const opts = parse();
    expect(opts.scenario).toBe('base');
    expect(opts.apply).toBe(false);
  });

  it('selects the pages scenario only when asked', () => {
    expect(parse('--scenario', 'pages').scenario).toBe('pages');
    expect(parse('--scenario', 'base').scenario).toBe('base');
  });

  it('rejects an unknown scenario instead of falling back to base', () => {
    expect(() => parse('--scenario', 'page')).toThrow(
      /Unknown --scenario "page"/,
    );
    expect(() => parse('--scenario')).toThrow(/Unknown --scenario/);
  });

  it('passes the chosen backup approver through', () => {
    expect(parse('--backup-approver', 'CICC-ALT01').backupApprover).toBe(
      'CICC-ALT01',
    );
    expect(parse().backupApprover).toBeUndefined();
  });
});

describe('loadAccounts', () => {
  it('does not echo the file path when the file is missing', () => {
    const message = messageFor(
      join(tmpdir(), 'secret-location', 'accounts.json'),
    );
    expect(message).toMatch(/Cannot read the accounts file/);
    expect(message).not.toContain('secret-location');
  });

  it('does not echo the file path when the JSON is invalid', () => {
    // This spec file exists and is not JSON.
    const message = messageFor(__filename);
    expect(message).toMatch(/not valid JSON/);
    expect(message).not.toContain('seed.spec');
  });
});
