/**
 * Shared test environment setup.
 *
 * happy-dom does not implement `window.matchMedia`; the theme work (T-010)
 * depends on it, and the theme boot code runs on import. Providing a minimal,
 * deterministic implementation here keeps component tests free of per-file
 * polyfills.
 */
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false
    }) as MediaQueryList;
}
