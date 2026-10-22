<template>
  <!--
    Shared per-locale completeness verdict (T-028 gate fix, FU1).

    Text-only by contract: the verdict is never communicated by colour alone
    (docs/DESIGN_SYSTEM.md §6). The project, site-page and team editors all
    render this component so their missing-translation indicators cannot drift.
  -->
  <span class="translation-status">{{ label }}</span>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";

import {
  formatCompletenessLabel,
  type CompletenessLabelKeys,
  type LocaleCompleteness
} from "@/features/admin/shared/completeness";

const props = defineProps<{
  readonly entry: LocaleCompleteness;
  readonly labels: CompletenessLabelKeys;
}>();

const { t } = useI18n();

const label = computed(() =>
  formatCompletenessLabel(props.entry, t, props.labels)
);
</script>

<style scoped>
.translation-status {
  color: var(--color-text-muted);
  font-size: var(--font-size-small);
  font-weight: 400;
}
</style>
