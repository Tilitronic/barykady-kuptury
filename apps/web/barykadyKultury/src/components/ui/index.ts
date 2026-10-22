/**
 * ui/ — the application's single Quasar seam.
 *
 * Every Quasar UI component the app renders is wrapped here once: stable
 * import surface for call-sites, brand defaults in one place, and a
 * mechanical migration path if a primitive is ever swapped. Quasar service
 * APIs (Dark, Notify, boot-time plugin install) are NOT UI components and
 * stay outside this seam.
 *
 * The seam is enforced by src/components/ui/__tests__/ui.test.ts — direct
 * `from "quasar"` UI imports or raw <q-*> tags outside ui/ fail CI.
 */
export { default as UiBanner } from "./UiBanner.vue";
export { default as UiBtn } from "./UiBtn.vue";
export { default as UiCard } from "./UiCard.vue";
export { default as UiCardSection } from "./UiCardSection.vue";
export { default as UiCheckbox } from "./UiCheckbox.vue";
export { default as UiConfirmDialog } from "./UiConfirmDialog.vue";
export { default as UiExpansionItem } from "./UiExpansionItem.vue";
export { default as UiForm } from "./UiForm.vue";
export { default as UiInput } from "./UiInput.vue";
export { default as UiItem } from "./UiItem.vue";
export { default as UiItemSection } from "./UiItemSection.vue";
export { default as UiList } from "./UiList.vue";
export { default as UiSelect } from "./UiSelect.vue";
export { default as UiSkeleton } from "./UiSkeleton.vue";
export { default as UiSlider } from "./UiSlider.vue";
export { default as UiTooltip } from "./UiTooltip.vue";
