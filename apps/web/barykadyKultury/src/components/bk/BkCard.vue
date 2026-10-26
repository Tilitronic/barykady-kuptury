<template>
  <QCard v-bind="$attrs">
    <template v-for="(_, name) in $slots" #[name]="scope">
      <slot :name="name" v-bind="(scope as Record<string, unknown>) ?? {}" />
    </template>
  </QCard>
</template>

<script setup lang="ts">
import { QCard } from "quasar";

/**
 * BkCard — the bk/ seam over Quasar QCard.
 *
 * WHY a pass-through with no defaults: card elevation, border and padding are
 * layout decisions owned by each surface (a form card and a preview card are
 * not the same object). The wrapper keeps Quasar imports inside bk/ without
 * imposing a visual opinion, so migrating a call-site cannot restyle it.
 * Attributes, events and slots ride through untouched.
 */
defineOptions({ inheritAttrs: false });
</script>
