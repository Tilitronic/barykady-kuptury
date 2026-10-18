<template>
  <div class="events-page">
    <h1 class="events-page__title">{{ t("events.title") }}</h1>
    <p class="events-page__lead">{{ t("events.placeholder") }}</p>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";

/**
 * Events page stub. T-011 wires the route; T-023/T-024 own the real content.
 * PublicLayout provides the shell — do NOT add AppShell here.
 */
const { t } = useI18n();
</script>

<style scoped>
.events-page__title {
  margin: 0 0 1rem;
}

.events-page__lead {
  margin: 0;
  color: var(--color-text-muted);
}
</style>
