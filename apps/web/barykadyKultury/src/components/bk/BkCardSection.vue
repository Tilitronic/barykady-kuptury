<template>
  <QCardSection v-bind="$attrs">
    <template v-for="(_, name) in $slots" #[name]="scope">
      <slot :name="name" v-bind="(scope as Record<string, unknown>) ?? {}" />
    </template>
  </QCardSection>
</template>

<script setup lang="ts">
import { QCardSection } from "quasar";

/**
 * BkCardSection — the bk/ seam over Quasar QCardSection.
 *
 * WHY a pass-through: a card section is purely a semantic/padding grouping
 * inside BkCard. The seam keeps the Quasar import out of page code, while the
 * caller keeps full control of spacing through its own SCSS. Attributes,
 * events and slots ride through untouched, so the rendered DOM is identical
 * to raw QCardSection.
 */
defineOptions({ inheritAttrs: false });
</script>
