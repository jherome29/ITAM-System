import 'reflect-metadata'; // decorator metadata polyfill — this spec loads the
// DTO directly without going through @nestjs/testing, which normally pulls it in
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { FulfillRequisitionDto } from './approval.dto';

// Focused validation-only coverage for the nested fulfilledItems shape — a raw
// non-UUID string must be rejected at the DTO boundary (400) rather than
// reaching assetRepo.findOne / itemRepo.update and surfacing as a Postgres 500.
describe('FulfillRequisitionDto — fulfilledItems nested validation', () => {
  const A_UUID = '11111111-1111-4111-8111-111111111111';
  const B_UUID = '22222222-2222-4222-8222-222222222222';

  it('rejects an entry whose ids are not UUIDs', async () => {
    const dto = plainToInstance(FulfillRequisitionDto, {
      fulfilledItems: [{ requisitionItemId: 'not-a-uuid', assetId: 'x' }],
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('accepts an entry whose ids are valid UUIDs', async () => {
    const dto = plainToInstance(FulfillRequisitionDto, {
      fulfilledItems: [{ requisitionItemId: A_UUID, assetId: B_UUID }],
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('accepts a body that omits fulfilledItems entirely (optional)', async () => {
    const dto = plainToInstance(FulfillRequisitionDto, { notes: 'issued' });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('rejects a fulfilledItems value that is not an array', async () => {
    const dto = plainToInstance(FulfillRequisitionDto, {
      fulfilledItems: 'nope',
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });
});
