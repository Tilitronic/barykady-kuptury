import { defineBoot } from "#q-app";

import { themeController } from "@/features/theme/themeRuntime";

/**
 * Installs the T-010 theme runtime.
 *
 * Runs after Quasar is installed and before the app mounts, so the resolved
 * theme (from `bk.theme`, else the system preference) is applied to both
 * mechanisms — `[data-theme]` and `Quasar.Dark` — before the first component
 * render. The no-flash pre-paint pass lives in `public/theme-init.js`, which
 * applies the same resolved value before any JS bundle executes; this boot is
 * the authoritative runtime that also wires the live `matchMedia` listener.
 *
 * docs/architecture.md §8 places theme initialization in a boot file.
 */
export default defineBoot(() => {
  themeController.init();
});
