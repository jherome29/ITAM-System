import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { RejectAssetRequestDto } from './asset-request.dto';

// A rejection is the only explanation the requester gets, and it is kept on the
// record. A two-letter "no" was accepted.
describe('RejectAssetRequestDto', () => {
  const errorsFor = async (reason: unknown) =>
    (await validate(plainToInstance(RejectAssetRequestDto, { reason }))).map(
      (e) => e.property,
    );

  it('accepts a real explanation', async () => {
    expect(
      await errorsFor('The unit is still needed for the briefing next week.'),
    ).toEqual([]);
  });

  it.each(['', 'no', 'not now', '         '])(
    'rejects "%s" as too short to explain anything',
    async (reason) => {
      expect(await errorsFor(reason)).toEqual(['reason']);
    },
  );

  it('counts the words, not the padding around them', async () => {
    expect(await errorsFor('   no   ')).toEqual(['reason']);
  });

  it('accepts exactly the minimum length', async () => {
    expect(await errorsFor('1234567890')).toEqual([]);
  });
});
