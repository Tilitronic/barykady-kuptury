<template>
  <QCheckbox :model-value="modelValue" v-bind="$attrs">
    <template v-for="(_, name) in $slots" #[name]="scope">
      <slot :name="name" v-bind="(scope as Record<string, unknown>) ?? {}" />
    </template>
  </QCheckbox>
</template>

<script setup lang="ts">
import { QCheckbox } from "quasar";

/**
 * BkCheckbox — the bk/ seam over Quasar QCheckbox.
 *
 * WHY modelValue is declared (instead of leaving it in $attrs): Quasar's field
 * components type modelValue as required, so an undeclared prop makes vue-tsc
 * reject a wrapper that does not forward it explicitly. Declaring the prop
 * keeps the types honest while the value is forwarded verbatim; the
 * update:modelValue listener rides $attrs untouched. The wrapper adds no
 * visual default because checked/unchecked styling belongs to Quasar and the
 * design system, not to a checkbox instance.
 */
defineOptions({ inheritAttrs: false });

defineProps<{ modelValue?: unknown }>();
</script>
