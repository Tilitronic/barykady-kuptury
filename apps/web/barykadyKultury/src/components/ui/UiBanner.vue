<template>
  <!--
    UiBanner.vue — the ui/ seam over Quasar QBanner. Pure pass-through of
    attrs, slots and events: the rendered DOM is identical to the raw
    component, so migrating a call-site can never restyle anything. 
  -->
  <QBanner v-bind="$attrs">
    <template v-for="(_, name) in $slots" #[name]="scope">
      <slot :name="name" v-bind="(scope as Record<string, unknown>) ?? {}" />
    </template>
  </QBanner>
</template>

<script setup lang="ts">
import { QBanner } from "quasar";

defineOptions({ inheritAttrs: false });
</script>
