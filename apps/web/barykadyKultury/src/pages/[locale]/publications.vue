<template>
  <div class="publications-page">
    <h1 class="publications-page__title">{{ t("publications.title") }}</h1>
    <p class="publications-page__lead">{{ t("publications.placeholder") }}</p>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";

/**
 * Publications page stub. T-011 wires the route; T-018/T-019 own the real
 * content. PublicLayout provides the shell — do NOT add AppShell here.
 */
const { t } = useI18n();
</script>

<style scoped>
.publications-page__title {
  margin: 0 0 1rem;
}

.publications-page__lead {
  margin: 0;
  color: var(--color-text-muted);
}
</style>
