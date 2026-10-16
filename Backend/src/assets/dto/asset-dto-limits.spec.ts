import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateAssetDto } from './create-asset.dto';
import { UpdateAssetDto } from './update-asset.dto';
import { FIELD_MAX } from '../../common/field-limits';

// The text columns of `assets` are VARCHAR(100) / (200) in Database/schemas/001_initial_schema.sql.
// A value one character too long was not stopped at the door: Postgres refused it and the
// client got a bare 500 ("An unexpected error occurred") with no hint which field was at fault.
// Now the field is named in a 400.

const validAsset = {
  itemDescription: 'Dell Latitude 5400 laptop',
  assetClass: 'SEP',
  assetType: 'ICT',
};

const problems = async (cls: new () => object, dto: object) =>
  (await validate(plainToInstance(cls, dto))).flatMap((e) =>
    Object.values(e.constraints ?? {}),
  );

const LIMITED = [
  ['sapClassification', FIELD_MAX.code],
  ['itemCode', FIELD_MAX.code],
  ['brand', FIELD_MAX.code],
  ['serialNumber', FIELD_MAX.code],
  ['propertyNumber', FIELD_MAX.code],
  ['division', FIELD_MAX.code],
  ['officeOrSection', FIELD_MAX.code],
  ['accountableOfficer', FIELD_MAX.long],
  ['officeLocation', FIELD_MAX.long],
  ['supplier', FIELD_MAX.long],
] as const;

describe.each([
  ['CreateAssetDto', CreateAssetDto],
  ['UpdateAssetDto', UpdateAssetDto],
])('%s text limits', (_name, cls) => {
  it.each(LIMITED)(
    'refuses a %s longer than %i characters, by name',
    async (field, max) => {
      const found = await problems(cls, {
        ...validAsset,
        [field]: 'x'.repeat(max + 1),
      });

      expect(found).toEqual([expect.stringContaining(field)]);
      expect(found[0]).toContain(String(max));
    },
  );

  it.each(LIMITED)(
    'accepts a %s of exactly %i characters',
    async (field, max) => {
      expect(
        await problems(cls, { ...validAsset, [field]: 'x'.repeat(max) }),
      ).toEqual([]);
    },
  );

  it('refuses a cost the NUMERIC(12,2) column cannot hold', async () => {
    const found = await problems(cls, {
      ...validAsset,
      acquisitionCost: 10_000_000_000,
    });

    expect(found.join(' ')).toContain('acquisitionCost');
    expect(
      await problems(cls, { ...validAsset, acquisitionCost: 9_999_999_999.99 }),
    ).toEqual([]);
  });

  it('refuses a stock count the INT column cannot hold', async () => {
    const found = await problems(cls, {
      ...validAsset,
      quantity: 2_147_483_648,
    });

    expect(found.join(' ')).toContain('quantity');
    expect(
      await problems(cls, { ...validAsset, quantity: 2_147_483_647 }),
    ).toEqual([]);
  });

  it('lets the long free-text fields be as long as the request body allows', async () => {
    expect(
      await problems(cls, {
        ...validAsset,
        itemDescription: 'y'.repeat(20_000),
        components: 'z'.repeat(20_000),
      }),
    ).toEqual([]);
  });
});
