<template>
  <QTooltip v-bind="$attrs">
    <template v-for="(_, name) in $slots" #[name]="scope">
      <slot :name="name" v-bind="(scope as Record<string, unknown>) ?? {}" />
    </template>
  </QTooltip>
</template>

<script setup lang="ts">
import { QTooltip } from "quasar";

/**
 * BkTooltip — the bk/ seam over Quasar QTooltip.
 *
 * WHY a pass-through: QTooltip teleports and manages its own show/hide and
 * ARIA wiring, and the trigger/anchor are call-site specific. The wrapper
 * keeps Quasar imports inside bk/ without changing that behaviour.
 * Attributes, events and slots ride through untouched.
 */
defineOptions({ inheritAttrs: false });
</script>
