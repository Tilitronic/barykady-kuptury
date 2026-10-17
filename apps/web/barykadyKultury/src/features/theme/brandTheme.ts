import type { Theme } from "./theme";

/**
 * Applies the brand-token theme by setting the D-20 selector on `<html>`.
 *
 * D-20 (docs/tickets/DECISIONS.md) permits exactly two dark-mode mechanisms and
 * forbids the `.dark` class. This function owns the CSS half — the
 * `[data-theme="dark"]` attribute consumed by `src/css/tokens.css` — while the
 * runtime wiring owns the `Quasar.Dark.set()` half, both written together from
 * the same resolved value so the page can never be half-themed.
 *
 * The `doc` argument is injectable so the function stays testable without a
 * global document; `null` (non-browser) is a no-op.
 */
export function applyBrandTheme(doc: Document | null, theme: Theme): void {
  if (!doc) return;

  doc.documentElement.setAttribute("data-theme", theme);
}
