/**
 * Quasar icon map for the components the app actually uses.
 *
 * T-044 removed the Material Icons webfont from `extras` because the public
 * surface uses project SVGs. Quasar's internal components (QSelect, QCheckbox,
 * QExpansionItem, QDialog, QBtn with an icon) still request icon names such as
 * `arrow_drop_down`; without a font those names render as literal ligature
 * text, which is both visually wrong and wide enough to break the 360 px
 * layout (T-032 mobile journey matrix caught the QSelect arrow overflowing the
 * viewport by 48 px).
 *
 * `iconMapFn` is Quasar's supported seam: any name present here is rendered as
 * an inline SVG path instead of a font glyph. Only the names the app can
 * actually request are mapped; unknown names fall back to Quasar's default
 * behaviour so this stays a targeted fix, not a second icon library.
 *
 * Paths are the standard 24×24 Material Design geometry. They are decorative
 * (QIcon sets `aria-hidden`), so nearby text keeps carrying the meaning.
 */
const ICON_PATHS: Record<string, string> = {
  arrow_drop_down: "M7 10l5 5 5-5z",
  arrow_drop_up: "M7 14l5-5 5 5z",
  arrow_upward: "M4 12l1.41 1.41L11 7.83V20h2V7.83l5.58 5.59L20 12l-8-8-8 8z",
  arrow_downward:
    "M20 12l-1.41-1.41L13 16.17V4h-2v12.17l-5.58-5.59L4 12l8 8 8-8z",
  arrow_forward: "M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z",
  arrow_back: "M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z",
  chevron_left: "M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z",
  chevron_right: "M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z",
  keyboard_arrow_down:
    "M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z",
  keyboard_arrow_up: "M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6 1.41 1.41z",
  keyboard_arrow_left:
    "M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6 1.41-1.41z",
  keyboard_arrow_right:
    "M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z",
  check: "M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z",
  close:
    "M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z",
  cancel:
    "M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z",
  error:
    "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z",
  warning: "M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z",
  info: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z",
  priority_high: "M10 3h4v12h-4zM10 17h4v4h-4z",
  check_circle:
    "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z",
  download: "M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z",
  refresh:
    "M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z",
  play_arrow: "M8 5v14l11-7z",
  first_page: "M18.41 16.59L13.82 12l4.59-4.59L17 6l-6 6 6 6zM6 6h2v12H6z",
  last_page: "M5.59 7.41L10.18 12l-4.59 4.59L7 18l6-6-6-6zM16 6h2v12h-2z",
  add: "M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6z",
  done: "M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z",
  expand_more: "M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z",
  expand_less: "M12 8l-6 6 1.41 1.41L12 10.83l4.59 4.58L18 14z",
  more_vert:
    "M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z",
  search:
    "M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"
};

/** Names this app guarantees to render as inline SVG (regression-test contract). */
export const MAPPED_ICON_NAMES: readonly string[] = Object.keys(ICON_PATHS);

/**
 * Quasar `iconMapFn` seam. Returning `undefined` leaves the name untouched so
 * any future component keeps Quasar's documented default rather than silently
 * losing its icon.
 */
export function iconMapFn(iconName: string): { icon: string } | undefined {
  const path = ICON_PATHS[iconName];
  return path === undefined ? undefined : { icon: `${path}|0 0 24 24` };
}
