<template>
  <QItemSection v-bind="$attrs">
    <template v-for="(_, name) in $slots" #[name]="scope">
      <slot :name="name" v-bind="(scope as Record<string, unknown>) ?? {}" />
    </template>
  </QItemSection>
</template>

<script setup lang="ts">
import { QItemSection } from "quasar";

/**
 * BkItemSection — the bk/ seam over Quasar QItemSection.
 *
 * WHY a pass-through: the section is the label/content slot of BkItem; its
 * position (side/top/avatar) is a call-site choice. The wrapper exists only
 * to keep Quasar imports inside bk/, so attributes, events and slots ride
 * through untouched and the DOM stays identical to raw QItemSection.
 */
defineOptions({ inheritAttrs: false });
</script>
