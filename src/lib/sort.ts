/** Building blocks shared by the client-side list sorts (files, favorites). */

export type SortDirection = "asc" | "desc";

/**
 * A field a list can be sorted by: its label, the direction picking it starts
 * in, and a plain-language name for each direction ("A to Z", "Newest first").
 */
export interface SortFieldOption<F extends string> {
  value: F;
  label: string;
  defaultDirection: SortDirection;
  asc: string;
  desc: string;
}

export interface Sort<F extends string> {
  field: F;
  direction: SortDirection;
}

function findField<F extends string>(fields: readonly SortFieldOption<F>[], field: F) {
  return fields.find((option) => option.value === field)!;
}

/** A field at its natural direction. */
export function getNaturalSort<F extends string>(
  fields: readonly SortFieldOption<F>[],
  field: F,
): Sort<F> {
  return { field, direction: findField(fields, field).defaultDirection };
}

/** The order a sort puts a list in, in words: "Newest first", "A to Z". */
export function describeSortOrder<F extends string>(
  fields: readonly SortFieldOption<F>[],
  { field, direction }: Sort<F>,
): string {
  return findField(fields, field)[direction];
}

/**
 * A fixed locale rather than the runtime's, so the server render and the
 * browser put names in the same order. Numeric, so "File 2" comes before
 * "File 10"; base sensitivity, so case and accents don't split names apart.
 */
export const nameCollator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });
