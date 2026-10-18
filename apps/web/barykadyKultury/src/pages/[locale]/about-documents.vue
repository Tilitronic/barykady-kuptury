<template>
  <div class="about-documents-page">
    <h1 class="about-documents-page__title">{{ t("aboutDocuments.title") }}</h1>
    <p class="about-documents-page__lead">{{
      t("aboutDocuments.placeholder")
    }}</p>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";

/**
 * About → Documents page stub. T-011 wires the route; T-017 owns the real
 * content. PublicLayout provides the shell — do NOT add AppShell here.
 */
const { t } = useI18n();
</script>

<style scoped>
.about-documents-page__title {
  margin: 0 0 1rem;
}

.about-documents-page__lead {
  margin: 0;
  color: var(--color-text-muted);
}
</style>
