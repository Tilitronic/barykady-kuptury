<template>
  <!--
    UiItemSection.vue — the ui/ seam over Quasar QItemSection. Pure pass-through of
    attrs, slots and events: the rendered DOM is identical to the raw
    component, so migrating a call-site can never restyle anything. 
  -->
  <QItemSection v-bind="$attrs">
    <template v-for="(_, name) in $slots" #[name]="scope">
      <slot :name="name" v-bind="(scope as Record<string, unknown>) ?? {}" />
    </template>
  </QItemSection>
</template>

<script setup lang="ts">
import { QItemSection } from "quasar";

defineOptions({ inheritAttrs: false });
</script>
