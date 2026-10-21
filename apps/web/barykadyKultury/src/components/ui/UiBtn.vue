<template>
  <!--
    UiBtn — the brand button (ui/ seam). Quasar QBtn underneath; the variant
    prop selects the surface treatment, everything else (type, disabled,
    loading, icons, events) passes straight through as attrs.

    Brand defaults:
      - noCaps: the DS type system is sentence-case; Quasar's caps transform
        would fight it (DESIGN_SYSTEM §2).
      - primary = unelevated SCARLET ($primary maps to SCARLET via
        quasar.variables.scss; white on scarlet measures 6.17:1 — AA body).
      - secondary = unelevated NERO-derived neutral: the restrained second
        surface (DESIGN_SYSTEM §3: scarlet stays the dominant action).
      - flat / outline: borderless or hairline actions.
    Callers may override any default via attrs — pass-through wins.
  -->
  <QBtn v-bind="merged">
    <template v-for="(_, name) in $slots" #[name]="scope">
      <slot :name="name" v-bind="(scope as Record<string, unknown>) ?? {}" />
    </template>
  </QBtn>
</template>

<script setup lang="ts">
import { computed, useAttrs } from "vue";
import { QBtn } from "quasar";

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
