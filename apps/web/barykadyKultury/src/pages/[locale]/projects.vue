<template>
  <div class="projects">
    <h1 class="projects__title">{{ t("projects.title") }}</h1>
    <p class="projects__lead">{{ t("projects.placeholder") }}</p>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";

/**
 * Projects placeholder page. T-016 owns the real content; this route exists so
 * the locale URL contract (`/:locale/projects`) and language switching can be
 * exercised end to end (T-009 acceptance criteria).
 * PublicLayout (router parent) provides the shell — AppShell is not used here.
 */
const { t } = useI18n();
</script>

<style scoped>
.projects__title {
  margin: 0 0 1rem;
  font-size: clamp(1.75rem, 5vw, 3rem);
  line-height: 1.1;
}

.projects__lead {
  margin: 0;
  font-size: 1.125rem;
  line-height: 1.6;
}
</style>
