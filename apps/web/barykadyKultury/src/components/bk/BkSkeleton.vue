<template>
  <QSkeleton v-bind="$attrs">
    <template v-for="(_, name) in $slots" #[name]="scope">
      <slot :name="name" v-bind="(scope as Record<string, unknown>) ?? {}" />
    </template>
  </QSkeleton>
</template>

<script setup lang="ts">
import { QSkeleton } from "quasar";

/**
 * BkSkeleton — the bk/ seam over Quasar QSkeleton.
 *
 * WHY a pass-through: a skeleton communicates "content is arriving" and must
 * match the box it replaces, so width/height/type are call-site decisions.
 * The wrapper keeps Quasar imports inside bk/ and imposes no default that
 * could make a loading placeholder the wrong size. Attributes, events and
 * slots ride through untouched.
 */
defineOptions({ inheritAttrs: false });
</script>
