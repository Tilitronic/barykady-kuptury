<template>
  <AppShell>
    <div class="not-found">
      <h1 class="not-found__title">{{ t("notFound.title") }}</h1>
      <p class="not-found__message">{{ t("notFound.message") }}</p>
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";

import AppShell from "@/components/AppShell.vue";

/**
 * 404 view for unknown locale segments and unmatched routes. Rendering it —
 * rather than redirecting to a valid locale — keeps the requested URL intact
 * and prevents a redirect loop (T-009 acceptance criteria).
 */
const { t } = useI18n();
</script>

<style scoped>
.not-found__title {
  margin: 0 0 1rem;
  font-size: clamp(1.75rem, 5vw, 3rem);
  line-height: 1.1;
}

.not-found__message {
  margin: 0;
  font-size: 1.125rem;
  line-height: 1.6;
}
</style>
