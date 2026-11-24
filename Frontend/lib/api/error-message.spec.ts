import { describe, expect, it } from 'vitest';
import { apiErrorMessage } from './error-message';

// A file download asks axios for a Blob, so when the server refuses (400 "Asset
// has no assigned custodian") the explanation arrives as a Blob of JSON. The
// screens used to read response.data.message off it, find nothing, and show a
// generic "Failed to generate" that told the custodian nothing they could act on.

const failure = (data: unknown) => ({ response: { data } });
const jsonBlob = (body: object) =>
  new Blob([JSON.stringify(body)], { type: 'application/json' });

describe('apiErrorMessage', () => {
  it('reads the message of an ordinary JSON error', async () => {
    expect(await apiErrorMessage(failure({ message: 'Asset is not available' }), 'fallback')).toBe(
      'Asset is not available',
    );
  });

  it('joins the messages of a validation error', async () => {
    expect(
      await apiErrorMessage(failure({ message: ['assetId must be a UUID', 'format is required'] }), 'fallback'),
    ).toBe('assetId must be a UUID; format is required');
  });

  it('reads the message out of an error that arrived as a Blob', async () => {
    const err = failure(jsonBlob({ message: 'Asset a-1 has no assigned custodian' }));

    expect(await apiErrorMessage(err, 'fallback')).toBe('Asset a-1 has no assigned custodian');
  });

  it('uses the fallback when the Blob is not JSON', async () => {
    expect(await apiErrorMessage(failure(new Blob(['<html>502</html>'])), 'Could not generate')).toBe(
      'Could not generate',
    );
  });

  it('uses the fallback when there is no response at all', async () => {
    expect(await apiErrorMessage(new Error('Network Error'), 'Could not generate')).toBe('Could not generate');
    expect(await apiErrorMessage(undefined, 'Could not generate')).toBe('Could not generate');
  });

  it('uses the fallback when the message is empty', async () => {
    expect(await apiErrorMessage(failure({ message: '' }), 'Could not generate')).toBe('Could not generate');
  });
});
