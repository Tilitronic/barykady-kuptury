import { readonly, ref, type Ref } from "vue";

import {
  nextOverride,
  resolveTheme,
  type Theme,
  type ThemeOverride
} from "./theme";
import type { ThemeStore } from "./themeStorage";

/**
 * Everything the controller needs from the outside world, injected so the
 * single-source-of-truth logic is unit-testable without Quasar or a real DOM.
 */
export interface ThemeControllerDeps {
  store: ThemeStore;
  /** Reads `matchMedia('(prefers-color-scheme: dark)')`. */
  readSystemPrefersDark: () => boolean;
  /** Subscribes to system changes; returns an unsubscribe function. */
  watchSystemPrefersDark: (
    onChange: (prefersDark: boolean) => void
  ) => () => void;
  /** Writes one resolved theme to every mechanism (D-20). */
  applyTheme: (theme: Theme) => void;
}

export interface ThemeController {
  /** The resolved theme currently applied to the document (read-only). */
  readonly theme: Readonly<Ref<Theme>>;
  /** The persisted user choice, or `null` while following the system. */
  readonly override: Readonly<Ref<ThemeOverride>>;
  /** Reads storage, applies the resolved theme and starts watching if needed. */
  init(): void;
  /** Sets (or clears with `null`) the explicit override and persists it. */
  setOverride(value: ThemeOverride): void;
  /** Flips to the opposite explicit theme — the toggle control's action. */
  toggle(): void;
  /** Detaches the system listener (tests / teardown). */
  dispose(): void;
}

/**
 * Owns the theme state and keeps the DOM and Quasar in lockstep.
 *
 * This is the single source of truth: `override` is the only persisted input,
 * `theme` is the only applied output, and every transition flows through one
 * `apply` call so a Pinia store, a DOM class and Quasar can never disagree
 * (T-010 review gate: no duplicated theme state). The design deliberately does
 * **not** use Pinia — a module-scoped reactive controller is enough for a fact
 * that already lives in `localStorage`.
 *
 * System changes are only honoured while no override is stored; storing an
 * override unsubscribes so the operating system can no longer move the page.
 */
export function createThemeController(
  dependencies: ThemeControllerDeps
): ThemeController {
  const override = ref<ThemeOverride>(null);
  const theme = ref<Theme>("light");
  let stopWatching: (() => void) | null = null;

  function resolvedFor(stored: ThemeOverride): Theme {
    return resolveTheme({
      systemPrefersDark: dependencies.readSystemPrefersDark(),
      stored
    });
  }

  function apply(value: Theme): void {
    theme.value = value;
    dependencies.applyTheme(value);
  }

  function startWatching(): void {
    stopWatching?.();
    stopWatching = dependencies.watchSystemPrefersDark(prefersDark => {
      // The listener only exists while there is no override; re-checking keeps
      // the guarantee even if a change lands after `setOverride` started.
      if (override.value === null) {
        apply(resolveTheme({ systemPrefersDark: prefersDark, stored: null }));
      }
    });
  }

  function stopWatchingSystems(): void {
    stopWatching?.();
    stopWatching = null;
  }

  return {
    theme: readonly(theme),
    override: readonly(override),

    init() {
      override.value = dependencies.store.read();
      apply(resolvedFor(override.value));

      if (override.value === null) {
        startWatching();
      }
    },

    setOverride(value) {
      override.value = value;

      if (value === null) {
        dependencies.store.clear();
        apply(resolvedFor(null));
        startWatching();
        return;
      }

      dependencies.store.write(value);
      stopWatchingSystems();
      apply(value);
    },

    toggle() {
      this.setOverride(nextOverride(theme.value));
    },

    dispose() {
      stopWatchingSystems();
    }
  };
}
