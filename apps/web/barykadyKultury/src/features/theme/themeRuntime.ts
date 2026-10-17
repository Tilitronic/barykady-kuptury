import { Dark } from "quasar";

import { applyBrandTheme } from "./brandTheme";
import { getSystemPrefersDark, watchSystemPrefersDark } from "./systemTheme";
import { createThemeController, type ThemeController } from "./themeController";
import type { Theme } from "./theme";
import { themeStore } from "./themeStorage";

/**
 * The application-wide theme controller, wired to the real browser and Quasar.
 *
 * It is created at module scope (not inside the boot file) so both the boot
 * (which calls `init()`) and the `ThemeToggle` component mutate the *same*
 * instance — one source of truth. `applyTheme` is the single D-20 write point:
 * the brand CSS custom properties (`[data-theme]` on `<html>`) and Quasar's
 * component internals (`Dark.set`, i.e. `body--dark`) are always updated
 * together, so the page cannot render half-themed.
 *
 * WHY `Quasar.Dark`: it is the canonical Quasar mechanism for component
 * theming; the brand tokens key off the same resolved value written here.
 */
export const themeController: ThemeController = createThemeController({
  store: themeStore,
  readSystemPrefersDark: getSystemPrefersDark,
  watchSystemPrefersDark,
  applyTheme(theme: Theme) {
    applyBrandTheme(typeof document === "undefined" ? null : document, theme);
    Dark.set(theme === "dark");
  }
});
