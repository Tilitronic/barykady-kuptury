<template>
  <QSlider :model-value="modelValue" v-bind="$attrs">
    <template v-for="(_, name) in $slots" #[name]="scope">
      <slot :name="name" v-bind="(scope as Record<string, unknown>) ?? {}" />
    </template>
  </QSlider>
</template>

<script setup lang="ts">
import { QSlider } from "quasar";

/**
 * BkSlider — the bk/ seam over Quasar QSlider.
 *
 * WHY the wrapper adds nothing: Quasar already provides the keyboard contract
 * (arrow steps, Home/End, aria-valuenow and the slider role) that the reader's
 * controls rely on. Re-implementing or overriding that would risk the a11y
 * contract, so the wrapper only forwards the model and attrs.
 *
 * WHY modelValue is declared: Quasar's field components type modelValue as
 * required, so leaving it to $attrs would break vue-tsc. The value is
 * forwarded verbatim and the update listener rides $attrs untouched.
 */
defineOptions({ inheritAttrs: false });

defineProps<{ modelValue?: number | null }>();
</script>
