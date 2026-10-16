import { describe, expect, it } from 'vitest';
import { MIN_REJECT_REASON_LENGTH, rejectReasonProblem } from './asset-request-rules';

// Mirrors RejectAssetRequestDto on the server: a rejection is the requester's
// only explanation and stays on the record.
describe('rejectReasonProblem', () => {
  it('has nothing to say about a real explanation', () => {
    expect(rejectReasonProblem('The unit is still needed for the briefing.')).toBeNull();
  });

  it('asks for more when it is too short, counting the trimmed text', () => {
    expect(rejectReasonProblem('')).toMatch(/at least/i);
    expect(rejectReasonProblem('no')).toMatch(/at least/i);
    expect(rejectReasonProblem('   no   ')).toMatch(/at least/i);
  });

  it('accepts exactly the minimum', () => {
    expect(rejectReasonProblem('x'.repeat(MIN_REJECT_REASON_LENGTH))).toBeNull();
  });

  it('says how many more characters are needed', () => {
    expect(rejectReasonProblem('abcd')).toContain(String(MIN_REJECT_REASON_LENGTH - 4));
  });
});
