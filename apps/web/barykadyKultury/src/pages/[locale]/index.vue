<template>
  <AppShell>
    <div class="home">
      <h1 class="home__title">{{ t("app.name") }}</h1>
      <p class="home__lead">{{ t("home.placeholder") }}</p>
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";

import AppShell from "@/components/AppShell.vue";

/**
 * Home page for a locale-prefixed route (`/:locale`). Copy comes from the
 * catalogues; nothing here is locale-conditional.
 */
const { t } = useI18n();
</script>

<style scoped>
.home__title {
  margin: 0 0 1rem;
  font-size: clamp(2rem, 6vw, 4rem);
  line-height: 1.05;
}

.home__lead {
  margin: 0;
  font-size: 1.125rem;
  line-height: 1.6;
}
</style>
