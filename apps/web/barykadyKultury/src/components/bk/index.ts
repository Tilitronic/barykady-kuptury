/**
 * bk/ — the application's single Quasar UI seam.
 *
 * WHY the seam exists: every Quasar UI component the app renders is wrapped
 * here once. Call-sites import stable full-word names instead of Quasar, brand
 * defaults live in one place, and a future primitive swap (or a design-system
 * migration) touches this folder rather than 20 pages. Quasar service APIs
 * (Dark, Notify, boot-time plugin install) are NOT UI components and stay
 * outside the seam.
 *
 * The seam is enforced by src/components/bk/__tests__/bk.test.ts: direct
 * `from "quasar"` UI imports and raw <q-*> tags outside bk/ fail CI. The
 * SCSS-only styling rule is enforced separately by stylingPolicy.test.ts.
 */

/** Banner surface for inline notices; pure pass-through of QBanner. */
export { default as BkBanner } from "./BkBanner.vue";
/** The brand button: variant defaults (primary/secondary/flat/outline) + no-caps. */
export { default as BkButton } from "./BkButton.vue";
/** Card container; elevation/border stay call-site decisions. */
export { default as BkCard } from "./BkCard.vue";
/** Semantic section inside a BkCard. */
export { default as BkCardSection } from "./BkCardSection.vue";
/** Checkbox field; declares modelValue so vue-tsc and callers agree on the contract. */
export { default as BkCheckbox } from "./BkCheckbox.vue";
/** Destructive confirmation dialog with a tested focus/escape/focus-return contract. */
export { default as BkConfirmDialog } from "./BkConfirmDialog.vue";
/** Disclosure primitive for TOC-style groups (D-34). */
export { default as BkExpansionItem } from "./BkExpansionItem.vue";
/** Form wrapper that keeps Quasar's submit/validation semantics. */
export { default as BkForm } from "./BkForm.vue";
/** Text field with the brand outlined treatment and live attribute merging (T-048). */
export { default as BkInput } from "./BkInput.vue";
/** List row/media primitive; tag semantics remain a call-site choice. */
export { default as BkItem } from "./BkItem.vue";
/** Content/icon section inside a BkItem. */
export { default as BkItemSection } from "./BkItemSection.vue";
/** List container; callers pass tag="ul" where real list semantics are required. */
export { default as BkList } from "./BkList.vue";
/** Select field with the brand outlined treatment. */
export { default as BkSelect } from "./BkSelect.vue";
/** Loading placeholder whose size must match the content it replaces. */
export { default as BkSkeleton } from "./BkSkeleton.vue";
/** Slider that preserves Quasar's keyboard and ARIA contract for the reader. */
export { default as BkSlider } from "./BkSlider.vue";
/** Tooltip; trigger and anchor remain call-site specific. */
export { default as BkTooltip } from "./BkTooltip.vue";
