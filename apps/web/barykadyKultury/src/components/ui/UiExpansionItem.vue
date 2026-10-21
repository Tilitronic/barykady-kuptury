<template>
  <!--
    UiExpansionItem.vue — the ui/ seam over Quasar QExpansionItem. Pure pass-through of
    attrs, slots and events: the rendered DOM is identical to the raw
    component, so migrating a call-site can never restyle anything. D-34: TOC-style groups use this, never QBtnToggle.
  -->
  <QExpansionItem v-bind="$attrs">
    <template v-for="(_, name) in $slots" #[name]="scope">
      <slot :name="name" v-bind="(scope as Record<string, unknown>) ?? {}" />
    </template>
  </QExpansionItem>
</template>

<script setup lang="ts">
import { QExpansionItem } from "quasar";

defineOptions({ inheritAttrs: false });
</script>
