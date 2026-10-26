<template>
  <QList v-bind="$attrs">
    <template v-for="(_, name) in $slots" #[name]="scope">
      <slot :name="name" v-bind="(scope as Record<string, unknown>) ?? {}" />
    </template>
  </QList>
</template>

<script setup lang="ts">
import { QList } from "quasar";

/**
 * BkList — the bk/ seam over Quasar QList.
 *
 * WHY the tag is left to the caller: QList renders a <div> by default, but
 * some call-sites (the page TOC) require real list semantics. Callers pass
 * tag="ul" so the document structure stays truthful; the wrapper must not
 * pick a tag on their behalf. Attributes, events and slots ride through
 * untouched.
 */
defineOptions({ inheritAttrs: false });
</script>
