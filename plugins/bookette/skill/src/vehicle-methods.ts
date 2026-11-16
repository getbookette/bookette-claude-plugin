// The closed vehicle-method vocabulary (ADR 0097): the only two figures a vehicle's row
// carries. check_outputs' profile gate rejects a first_year_method outside these words, and
// nothing importer-private names a third one - a method the importer or the report cannot
// render must fail the gate, not invent a word.
export const VEHICLE_METHODS = ['standard_mileage', 'actual_cost'] as const;

export type VehicleMethod = (typeof VEHICLE_METHODS)[number];
