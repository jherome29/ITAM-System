// How much each field a person types can hold, taken from the column sizes in
// Database/schemas/001_initial_schema.sql. A longer value used to be handed to Postgres, which
// refused it, and the client got a bare 500 with no hint which field was at fault. DTOs check
// these first, so the answer is a 400 that names the field.
//
// Change a column's size in the schema and change it here with it.
export const FIELD_MAX = {
  /** employee_id */
  employeeId: 50,
  /** Names, codes, brand, serial and property numbers, division, office or section: VARCHAR(100). */
  code: 100,
  /** Accountable officer, office location, supplier: VARCHAR(200). */
  long: 200,
  /** A few sentences of free text typed into a form: the circumstances of a loss, a purpose. */
  text: 2000,
} as const;

/** assets.acquisition_cost is NUMERIC(12,2): ten digits before the point. */
export const COST_MAX = 9_999_999_999.99;

/** A quantity or stock level is a Postgres INT. */
export const COUNT_MAX = 2_147_483_647;
