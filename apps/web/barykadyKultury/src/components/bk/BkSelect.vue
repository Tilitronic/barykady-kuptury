<template>
  <QSelect :model-value="modelValue" v-bind="merged">
    <template v-for="(_, name) in $slots" #[name]="scope">
      <slot :name="name" v-bind="(scope as Record<string, unknown>) ?? {}" />
    </template>
  </QSelect>
</template>

<script setup lang="ts">
import { useAttrs } from "vue";
import { QSelect } from "quasar";

/**
 * BkSelect — the bk/ seam over Quasar QSelect with the brand field treatment.
 *
 * WHY outlined is the only visual default: DESIGN_SYSTEM §5 names outlined as
 * the single field treatment, so a selector must look like the text inputs
 * beside it. Callers can override it through attrs (pass-through wins).
 *
 * WHY modelValue is declared: Quasar's field components type modelValue as
 * required, so leaving it to $attrs would break vue-tsc. The value is
 * forwarded verbatim and the update listener rides $attrs untouched.
 */
defineOptions({ inheritAttrs: false });

defineProps<{ modelValue?: unknown }>();

const attrs = useAttrs();
const merged = { outlined: true, ...(attrs as Record<string, unknown>) };
</script>
