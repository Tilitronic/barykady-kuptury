<template>
  <!--
    UiItem.vue — the ui/ seam over Quasar QItem. Pure pass-through of
    attrs, slots and events: the rendered DOM is identical to the raw
    component, so migrating a call-site can never restyle anything. 
  -->
  <QItem v-bind="$attrs">
    <template v-for="(_, name) in $slots" #[name]="scope">
      <slot :name="name" v-bind="(scope as Record<string, unknown>) ?? {}" />
    </template>
  </QItem>
</template>

<script setup lang="ts">
import { QItem } from "quasar";

defineOptions({ inheritAttrs: false });
</script>
