/**
 * Content query state shared by every feature data-access module (T-015
 * REFACTOR step 5).
 *
 * Pages need to render explicit states rather than inferring them from an empty
 * array (docs/TESTING.md §2: "accessible loading, empty, error, success states";
 * docs/PRODUCT_REQUIREMENTS.md §5: "intentional empty states"). A single
 * discriminated union keeps every feature's `api.ts` returning the same shape,
 * so a page can switch on `kind` without feature-specific handling.
 *
 * `ok` always carries at least one item: an empty result is `empty`, never
 * `ok` with an empty array, so pages cannot accidentally render a blank success
 * state.
 */

/** A read outcome: loading, usable rows, a real empty result, or an unavailable backend. */
export type ContentResult<T> =
  | { readonly kind: "loading" }
  | { readonly kind: "ok"; readonly items: readonly T[] }
  | { readonly kind: "empty" }
  | { readonly kind: "unavailable" };

/** The client was absent (unconfigured build) or the query failed. */
export function unavailable<T = never>(): ContentResult<T> {
  return { kind: "unavailable" };
}

/** Wraps already-mapped models, collapsing an empty list to `empty`. */
export function fromModels<T>(models: readonly T[]): ContentResult<T> {
  return models.length === 0
    ? { kind: "empty" }
    : { kind: "ok", items: models };
}

/**
 * Maps raw rows to domain models, dropping rows whose localized content is not
 * usable (an incomplete or absent translation), then applies {@link fromModels}.
 */
export function fromRows<TRow, TModel>(
  rows: readonly TRow[],
  map: (row: TRow) => TModel | null
): ContentResult<TModel> {
  const models: TModel[] = [];

  for (const row of rows) {
    const model = map(row);
    if (model !== null) models.push(model);
  }

  return fromModels(models);
}
