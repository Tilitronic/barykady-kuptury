<template>
  <QInput :model-value="modelValue" v-bind="merged">
    <template v-for="(_, name) in $slots" #[name]="scope">
      <slot :name="name" v-bind="(scope as Record<string, unknown>) ?? {}" />
    </template>
  </QInput>
</template>

<script setup lang="ts">
import { computed, useAttrs } from "vue";
import { QInput } from "quasar";

/**
 * BkInput — the bk/ seam over Quasar QInput with the brand field treatment.
 *
 * WHY outlined is the only visual default: DESIGN_SYSTEM §5 names outlined as
 * the single field treatment, so every admin form field must look like the
 * same control. Callers can still override the default through attrs
 * (pass-through wins).
 *
 * WHY modelValue is declared: Quasar's field components type modelValue as
 * required, so leaving it to $attrs would break vue-tsc. The value is
 * forwarded verbatim and the update listener rides $attrs untouched.
 */
defineOptions({ inheritAttrs: false });

defineProps<{ modelValue?: string | number | FileList | null }>();

const attrs = useAttrs();

/**
 * WHY computed instead of a one-time object spread: props such as `error` and
 * `error-message` change after mount when validation runs. A frozen snapshot
 * would keep the initial values forever — the T-048 stale-validation defect.
 * Computing on every render keeps Quasar's field state in sync.
 */
const merged = computed(() => ({
  outlined: true,
  ...(attrs as Record<string, unknown>)
}));
</script>
