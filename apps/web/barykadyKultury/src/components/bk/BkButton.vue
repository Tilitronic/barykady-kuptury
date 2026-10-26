<template>
  <QBtn v-bind="merged">
    <template v-for="(_, name) in $slots" #[name]="scope">
      <slot :name="name" v-bind="(scope as Record<string, unknown>) ?? {}" />
    </template>
  </QBtn>
</template>

<script setup lang="ts">
import { computed, useAttrs } from "vue";
import { QBtn } from "quasar";

/**
 * BkButton — the brand button surface over Quasar QBtn.
 *
 * WHY the brand defaults live here: every action in the product must read as
 * the same brand control, so the decision is made once instead of at each
 * call-site.
 *   - noCaps: the DS type system is sentence-case; Quasar's caps transform
 *     would fight it (DESIGN_SYSTEM §2).
 *   - primary = unelevated SCARLET ($primary maps to SCARLET via
 *     quasar.variables.scss; white on scarlet measures 6.17:1 — AA body).
 *   - secondary = unelevated NERO-derived neutral: the restrained second
 *     surface (DESIGN_SYSTEM §3: scarlet stays the dominant action).
 *   - flat / outline: borderless or hairline actions.
 *
 * WHY pass-through wins: callers may override any default with an explicit
 * attr. A wrapper that silently ignores a deliberate call-site choice would
 * make the seam surprising; type, disabled, loading, icons and events therefore
 * land on QBtn unchanged.
 */
defineOptions({ inheritAttrs: false });

const props = defineProps<{
  variant?: "primary" | "secondary" | "flat" | "outline";
}>();

const VARIANT_DEFAULTS: Record<string, Record<string, unknown>> = {
  primary: { color: "primary", unelevated: true },
  secondary: { color: "secondary", unelevated: true },
  flat: { color: "primary", flat: true },
  outline: { color: "primary", outline: true }
};

const attrs = useAttrs();

// Order matters: brand defaults first, then caller attrs so an explicit
// `flat`/`color`/`unelevated` on the call-site still wins.
const merged = computed(() => ({
  noCaps: true,
  ...VARIANT_DEFAULTS[props.variant ?? "primary"],
  ...(attrs as Record<string, unknown>)
}));
</script>
