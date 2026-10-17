/**
 * Browser `prefers-color-scheme` bridge.
 *
 * Isolated from the controller so the controller stays injectable and unit
 * testable: the controller receives these readers, tests pass literals, and the
 * runtime wiring passes the real functions. All access is guarded because
 * `matchMedia` is absent in some non-browser/older environments and legacy
 * implementations only expose `addListener`.
 */

const DARK_QUERY = "(prefers-color-scheme: dark)";

/** Reads the current system preference, defaulting to light when unknown. */
export function getSystemPrefersDark(): boolean {
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return false;
  }

  try {
    return window.matchMedia(DARK_QUERY).matches;
  } catch {
    return false;
  }
}

/**
 * Subscribes to live system-preference changes. Returns an unsubscribe function
 * so the controller can detach the listener as soon as an explicit override is
 * stored (system changes must then be ignored).
 *
 * Supports both the modern `addEventListener` API and the legacy
 * `addListener`/`removeListener` pair.
 */
export function watchSystemPrefersDark(
  onChange: (prefersDark: boolean) => void
): () => void {
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return () => undefined;
  }

  let media: MediaQueryList;
  try {
    media = window.matchMedia(DARK_QUERY);
  } catch {
    return () => undefined;
  }

  const handleChange = (event: MediaQueryListEvent): void => {
    onChange(event.matches);
  };

  if (typeof media.addEventListener === "function") {
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }

  // Legacy Safari/Edge fallback.
  media.addListener(handleChange);
  return () => media.removeListener(handleChange);
}
