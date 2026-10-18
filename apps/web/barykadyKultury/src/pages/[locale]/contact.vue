<template>
  <div class="contact-page">
    <h1 class="contact-page__title">{{ t("contact.title") }}</h1>
    <p class="contact-page__lead">{{ t("contact.placeholder") }}</p>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";

/**
 * Contact page stub. T-011 wires the route; T-021 owns the real content.
 * PublicLayout (the router layout parent) provides the shell — do NOT add AppShell here.
 */
const { t } = useI18n();
</script>

<style scoped>
.contact-page__title {
  margin: 0 0 1rem;
}

.contact-page__lead {
  margin: 0;
  color: var(--color-text-muted);
}
</style>
