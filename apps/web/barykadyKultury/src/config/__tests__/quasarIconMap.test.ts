import { describe, expect, it } from "vitest";

import { iconMapFn, MAPPED_ICON_NAMES } from "@/config/quasarIconMap";

/**
 * T-032 icon-map contract (regression guard).
 *
 * T-044 removed the Material Icons webfont. Quasar's internal components still
 * request ligature names such as `arrow_drop_down`; without a mapping they
 * render the name as literal text, which overflowed the 360 px admin form by
 * 48 px. This test pins the names the mounted components request and proves
 * `iconMapFn` turns them into inline SVG paths rather than leaving them to the
 * font fallback.
 */
const QUASAR_INTERNAL_ICONS = [
  // QSelect
  "arrow_drop_down",
  "arrow_drop_up",
  // QCheckbox / QDialog / QExpansionItem
  "check",
  "close",
  "expand_more",
  "expand_less",
  // LongFormReader QBtn
  "download",
  // Shared status/type glyphs
  "warning",
  "error",
  "info",
  "check_circle"
] as const;

describe("quasarIconMap", () => {
  it.each(QUASAR_INTERNAL_ICONS)(
    "maps %s to an inline SVG path with a 24×24 viewBox",
    name => {
      const mapped = iconMapFn(name);

      expect(mapped, `${name} would fall back to ligature text`).toBeDefined();
      expect(mapped?.icon).toMatch(/^M[^|]+\|0 0 24 24$/);
    }
  );

  it("covers every mounted Quasar-internal icon the app can request", () => {
    for (const name of QUASAR_INTERNAL_ICONS) {
      expect(MAPPED_ICON_NAMES).toContain(name);
    }
  });

  it("leaves genuinely unknown names to Quasar (no silent wrong glyph)", () => {
    expect(iconMapFn("not_a_real_icon_name")).toBeUndefined();
  });
});
