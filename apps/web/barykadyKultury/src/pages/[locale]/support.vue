<template>
  <div class="support-page">
    <h1 class="support-page__title">{{ t("support.title") }}</h1>
    <p class="support-page__lead">{{ t("support.placeholder") }}</p>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";

/**
 * Support us page stub. T-011 wires the route; T-022 owns the real content.
 * D-06 OPEN: no support options configured yet.
 * PublicLayout provides the shell — do NOT add AppShell here.
 */
const { t } = useI18n();
</script>

<style scoped>
.support-page__title {
  margin: 0 0 1rem;
}

.support-page__lead {
  margin: 0;
  color: var(--color-text-muted);
}
</style>
