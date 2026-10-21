<template>
  <!--
    UiInput.vue — the ui/ seam over Quasar QInput with one brand default.
    Outlined is the single field treatment in this design system (DESIGN_SYSTEM §5 token surface list). Callers can still override the default via attrs
    (pass-through wins).
  -->
  <QInput :model-value="modelValue" v-bind="merged">
    <template v-for="(_, name) in $slots" #[name]="scope">
      <slot :name="name" v-bind="(scope as Record<string, unknown>) ?? {}" />
    </template>
  </QInput>
</template>

<script setup lang="ts">
import { useAttrs } from "vue";
import { QInput } from "quasar";

defineOptions({ inheritAttrs: false });

// Declaring the v-model prop (not leaving it to $attrs) keeps vue-tsc happy:
// Quasar's field components type modelValue as required. The value is
// forwarded verbatim; the update listener rides $attrs untouched.
defineProps<{ modelValue?: string | number | FileList | null }>();

const attrs = useAttrs();
const merged = { outlined: true, ...(attrs as Record<string, unknown>) };
</script>
