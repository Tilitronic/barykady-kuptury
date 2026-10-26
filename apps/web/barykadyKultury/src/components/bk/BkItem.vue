<template>
  <QItem v-bind="$attrs">
    <template v-for="(_, name) in $slots" #[name]="scope">
      <slot :name="name" v-bind="(scope as Record<string, unknown>) ?? {}" />
    </template>
  </QItem>
</template>

<script setup lang="ts">
import { QItem } from "quasar";

/**
 * BkItem — the bk/ seam over Quasar QItem.
 *
 * WHY a pass-through: QItem is a layout/media primitive; its tag, href and
 * click behaviour are chosen by the caller (a TOC entry links, a summary row
 * does not). The wrapper keeps Quasar imports inside bk/ without imposing
 * semantics. Attributes, events and slots ride through untouched.
 */
defineOptions({ inheritAttrs: false });
</script>
