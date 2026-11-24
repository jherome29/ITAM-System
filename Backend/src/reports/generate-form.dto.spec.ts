import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { GenerateFormDto } from './reports.controller';
import { FIELD_MAX } from '../common/field-limits';

// The free text typed into a form (the office a property moves to, the circumstances of a loss) is
// printed on the page. Unbounded, a hundred-thousand-character office was accepted and answered with
// a 500; the field is now named in a 400, and what fits on a form is what the form can lay out.

const problems = async (dto: object) =>
  (await validate(plainToInstance(GenerateFormDto, dto))).flatMap((e) =>
    Object.values(e.constraints ?? {}),
  );

const LIMITED = [
  ['targetOffice', FIELD_MAX.long],
  ['requestingDivision', FIELD_MAX.long],
  ['circumstances', FIELD_MAX.text],
  ['purpose', FIELD_MAX.text],
  ['returneeEmployeeId', FIELD_MAX.employeeId],
] as const;

describe('GenerateFormDto text limits', () => {
  it.each(LIMITED)(
    'refuses a %s longer than %i characters, by name',
    async (field, max) => {
      const found = await problems({
        formType: 'PTR',
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
        await problems({ formType: 'PTR', [field]: 'x'.repeat(max) }),
      ).toEqual([]);
    },
  );
});
