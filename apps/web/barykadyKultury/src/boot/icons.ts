import { defineBoot } from "#q-app";

import { iconMapFn } from "@/config/quasarIconMap";

/**
 * Installs Quasar's icon-name mapping before the first component render.
 *
 * T-044 removed the Material Icons webfont, but Quasar's own components still
 * request names such as `arrow_drop_down`; without a mapping they render as
 * literal ligature text. `$q.iconMapFn` is the supported runtime seam, so the
 * project can keep zero webfont requests while components still get a real
 * glyph (see `quasarIconMap.ts` for the measured mobile regression).
 *
 * docs/design system §6: icon-only affordances must be meaningful and must not
 * distort the narrow layout; this boot keeps the visual contract intact.
 */
export default defineBoot(({ app }) => {
  app.config.globalProperties.$q.iconMapFn = iconMapFn;
});
