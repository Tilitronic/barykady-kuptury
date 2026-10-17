/**
 * T-010 theme pre-paint bootstrap (CSP-safe external script).
 *
 * WHY an external file instead of an inline <script>: index.html ships
 * `script-src 'self'` with no `unsafe-inline`, so a plain inline script is
 * blocked. Options considered were (a) an inline script with a SHA-256 hash in
 * the CSP or (b) this self-hosted file served under `'self'`. Option (b) is
 * chosen because it needs no CSP change, cannot silently break when the file's
 * bytes change (a hash must be recomputed on every edit), and is cacheable.
 *
 * This is a classic (non-module) parser-blocking script in <head>, so it runs
 * before the app bundle and before first paint — hence "no flash". It mirrors
 * the contract of the pure `resolveTheme` module in
 * `src/features/theme/theme.ts`: a valid stored override wins, otherwise the
 * system preference applies, otherwise light. `themeInitParity.test.ts` guards
 * that the two stay behaviourally identical.
 *
 * It only sets the brand-token selector `[data-theme]` (D-20). Quasar's
 * component theming is applied by the boot file once `document.body` exists,
 * from the same resolved value.
 */
(function () {
  "use strict";

  var KEY = "bk.theme";

  var stored = null;
  try {
    stored = window.localStorage.getItem(KEY);
  } catch {
    stored = null;
  }

  var systemPrefersDark = false;
  try {
    systemPrefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches;
  } catch {
    systemPrefersDark = false;
  }

  var theme =
    stored === "light" || stored === "dark"
      ? stored
      : systemPrefersDark
        ? "dark"
        : "light";

  document.documentElement.setAttribute("data-theme", theme);
})();
