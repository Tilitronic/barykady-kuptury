<template>
  <!--
    UiList.vue — the ui/ seam over Quasar QList. Pure pass-through of
    attrs, slots and events: the rendered DOM is identical to the raw
    component, so migrating a call-site can never restyle anything. tag="ul" call-sites keep real list semantics (PageToc contract).
  -->
  <QList v-bind="$attrs">
    <template v-for="(_, name) in $slots" #[name]="scope">
      <slot :name="name" v-bind="(scope as Record<string, unknown>) ?? {}" />
    </template>
  </QList>
</template>

<script setup lang="ts">
import { QList } from "quasar";

defineOptions({ inheritAttrs: false });
</script>
