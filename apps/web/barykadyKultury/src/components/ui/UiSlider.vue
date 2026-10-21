<template>
  <!--
    UiSlider.vue — the ui/ seam over Quasar QSlider. Pure pass-through of
    attrs, slots and events: the rendered DOM is identical to the raw
    component, so migrating a call-site can never restyle anything. Keyboard contract (arrow steps, aria) is Quasar's own — untouched.
  -->
  <QSlider :model-value="modelValue" v-bind="$attrs">
    <template v-for="(_, name) in $slots" #[name]="scope">
      <slot :name="name" v-bind="(scope as Record<string, unknown>) ?? {}" />
    </template>
  </QSlider>
</template>

<script setup lang="ts">
import { QSlider } from "quasar";

defineOptions({ inheritAttrs: false });

// Declaring the v-model prop (not leaving it to $attrs) keeps vue-tsc happy:
// Quasar's field components type modelValue as required. The value is
// forwarded verbatim; the update listener rides $attrs untouched.
defineProps<{ modelValue?: number | null }>();
</script>
