<template>
  <QForm v-bind="$attrs">
    <template v-for="(_, name) in $slots" #[name]="scope">
      <slot :name="name" v-bind="(scope as Record<string, unknown>) ?? {}" />
    </template>
  </QForm>
</template>

<script setup lang="ts">
import { QForm } from "quasar";

/**
 * BkForm — the bk/ seam over Quasar QForm.
 *
 * WHY a pass-through: QForm owns submit/greedy validation semantics, not
 * appearance. The wrapper keeps those semantics and the Quasar import inside
 * the seam while leaving spacing and layout to the caller's SCSS. Attributes
 * (including the submit listener), events and slots ride through untouched.
 */
defineOptions({ inheritAttrs: false });
</script>
