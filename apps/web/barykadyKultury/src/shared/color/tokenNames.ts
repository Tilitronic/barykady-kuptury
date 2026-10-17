/**
 * T-006: Authoritative list of required CSS custom property names.
 *
 * WHY this file exists: D-18 demands a _single source of truth_ for the token
 * contract so that both the CSS file and the automated completeness test are
 * driven by exactly the same list.  If a token is added here it must also be
 * present in `src/css/tokens.css`; the test enforces this mechanically.
 *
 * The names are the bare custom-property names WITHOUT the leading `--`.
 * Both `:root` (light) and the `[data-theme="dark"]` selector must define
 * every entry (D-20 — the `.dark` class is not used).
 *
 * rev-2 additions (T-006 rev-2):
 *   color-overlay       — modal/drawer scrim
 *   color-skeleton      — QSkeleton placeholder background
 *   color-skeleton-shine — QSkeleton shimmer highlight
 *   color-surface-danger — tinted error-banner surface
 */
export const REQUIRED_TOKENS = [
  // Backgrounds / surfaces
  "color-background",
  "color-surface",
  "color-surface-raised",
  "color-surface-danger",

  // Text
  "color-text",
  "color-text-muted",

  // Accent / interactive
  "color-accent",
  "color-accent-text",
  "color-link",
  "color-focus",

  // Borders
  "color-border",

  // Status
  "color-success",
  "color-warning",
  "color-danger",

  // Disabled state
  "color-disabled-text",
  "color-disabled-bg",

  // Form controls
  "color-form-bg",
  "color-form-border",

  // Dialog / dropdown surfaces
  "color-dialog-bg",

  // Overlay / scrim (modal, drawer backdrop)
  "color-overlay",

  // Skeleton loading state
  "color-skeleton",
  "color-skeleton-shine",

  // Shadows
  "shadow-sm",
  "shadow-md",
  "shadow-lg",

  // Motion
  "motion-duration"
] as const;

export type TokenName = (typeof REQUIRED_TOKENS)[number];
