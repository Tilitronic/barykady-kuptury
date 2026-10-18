<template>
  <div class="not-found">
    <h1 class="not-found__title">{{ t("notFound.title") }}</h1>
    <p class="not-found__message">{{ t("notFound.message") }}</p>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";

/**
 * 404 content for locale-prefixed routes rendered inside PublicLayout.
 * The shell (header/nav/footer) is provided by PublicLayout — do NOT wrap
 * in AppShell here. Keeping the URL intact prevents a redirect loop
 * (T-009 acceptance criteria).
 */
const { t } = useI18n();
</script>

<style scoped>
.not-found__title {
  margin: 0 0 1rem;
}

.not-found__message {
  margin: 0;
  color: var(--color-text-muted);
}
</style>
