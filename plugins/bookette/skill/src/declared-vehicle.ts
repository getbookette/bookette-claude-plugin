// The vehicle a person declares (issue #915, decision record 0116's amendment for the declared
// setup): the one validator the onboarding chat's vehicle card and Account's setup card share. The
// description goes through `personTextProblem`, the gate the declared entity's text fields use, so
// an accepted value never makes a later run reject; the first business use is a month, stored as
// its first day. No method and no depreciation are taken: the first-year method is established by
// documents or answers (0105), never chosen here (invariant 5). Which entity holds the vehicle is
// the caller's check, because only the database knows the workspace's entities. Pure and
// filesystem-free, so a client bundle may import it.

import { isValidDay } from './dates';
import { personTextProblem } from './person-text';
import type { PersonTextProblem } from './person-text';

export { entityNameKey as vehicleDescriptionKey } from './declared-entity';

/** The longest description, in UTF-16 code units: the declared entity name's bound. */
export const DECLARED_VEHICLE_DESCRIPTION_MAX_LENGTH = 120;

/** What a surface posts: the description as typed and the first business use as `YYYY-MM`. */
export interface DeclaredVehicleInput {
  readonly description: string;
  readonly firstBusinessUse: string;
}

export type DeclaredVehicleField = keyof DeclaredVehicleInput;

/** The canonical columns the declare core writes. */
export interface DeclaredVehicle {
  readonly description: string;
  /** The month's first day, `YYYY-MM-01`: the column is a date and the person states a month. */
  readonly firstBusinessUseDate: string;
}

export type DeclaredVehicleRefusal = PersonTextProblem | 'date';

export type DeclaredVehicleValidation<T> =
  | { readonly ok: true; readonly value: T }
  | {
      readonly ok: false;
      readonly code: DeclaredVehicleRefusal;
      /** The input the refusal is about, so a form can mark it; never its value. */
      readonly field: DeclaredVehicleField;
    };

/** The description alone, trimmed: an update that changes only the description validates this. */
export function validateVehicleDescription(raw: string): DeclaredVehicleValidation<string> {
  const description = raw.trim();
  const problem = personTextProblem(description, DECLARED_VEHICLE_DESCRIPTION_MAX_LENGTH);
  return problem === null
    ? { ok: true, value: description }
    : { ok: false, code: problem, field: 'description' };
}

/** A `YYYY-MM` month as its first day, or a `date` refusal for any other shape or a month past 12. */
export function validateFirstBusinessUse(raw: string): DeclaredVehicleValidation<string> {
  const month = raw.trim();
  const day = `${month}-01`;
  return /^\d{4}-\d{2}$/.test(month) && isValidDay(day)
    ? { ok: true, value: day }
    : { ok: false, code: 'date', field: 'firstBusinessUse' };
}

/**
 * The one validator for a declaration: the canonical columns or a typed refusal naming the field.
 * A refusal never carries the input, and nothing here logs.
 */
export function validateDeclaredVehicle(
  input: DeclaredVehicleInput,
): DeclaredVehicleValidation<DeclaredVehicle> {
  const description = validateVehicleDescription(input.description);
  if (!description.ok) return description;
  const firstBusinessUseDate = validateFirstBusinessUse(input.firstBusinessUse);
  if (!firstBusinessUseDate.ok) return firstBusinessUseDate;
  return {
    ok: true,
    value: { description: description.value, firstBusinessUseDate: firstBusinessUseDate.value },
  };
}
