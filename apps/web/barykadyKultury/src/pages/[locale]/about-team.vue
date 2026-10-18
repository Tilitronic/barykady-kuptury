<template>
  <div class="about-team-page">
    <h1 class="about-team-page__title">{{ t("aboutTeam.title") }}</h1>
    <p class="about-team-page__lead">{{ t("aboutTeam.placeholder") }}</p>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";

/**
 * About → Team page stub. T-011 wires the route; T-015 owns the real content.
 * PublicLayout provides the shell — do NOT add AppShell here.
 */
const { t } = useI18n();
</script>

<style scoped>
.about-team-page__title {
  margin: 0 0 1rem;
}

.about-team-page__lead {
  margin: 0;
  color: var(--color-text-muted);
}
</style>
