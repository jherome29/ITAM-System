import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadAccounts } from './seed';

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
