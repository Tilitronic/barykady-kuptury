<template>
  <!--
    UiCard.vue — the ui/ seam over Quasar QCard. Pure pass-through of
    attrs, slots and events: the rendered DOM is identical to the raw
    component, so migrating a call-site can never restyle anything. 
  -->
  <QCard v-bind="$attrs">
    <template v-for="(_, name) in $slots" #[name]="scope">
      <slot :name="name" v-bind="(scope as Record<string, unknown>) ?? {}" />
    </template>
  </QCard>
</template>

<script setup lang="ts">
import { QCard } from "quasar";

defineOptions({ inheritAttrs: false });
</script>
