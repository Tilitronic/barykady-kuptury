<template>
  <QExpansionItem v-bind="$attrs">
    <template v-for="(_, name) in $slots" #[name]="scope">
      <slot :name="name" v-bind="(scope as Record<string, unknown>) ?? {}" />
    </template>
  </QExpansionItem>
</template>

<script setup lang="ts">
import { QExpansionItem } from "quasar";

/**
 * BkExpansionItem — the bk/ seam over Quasar QExpansionItem.
 *
 * WHY this primitive and not a button toggle: D-34 established that TOC-style
 * disclosure groups use a real expansion item (keyboard + ARIA out of the box),
 * never QBtnToggle. The wrapper keeps that decision in one place and keeps
 * Quasar imports inside bk/. Attributes, events and slots ride through
 * untouched, so call-sites keep full control of label, icon and density.
 */
defineOptions({ inheritAttrs: false });
</script>
